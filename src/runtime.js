import { randomUUID } from "node:crypto";
import {
  actionSchema,
  apiSchemas,
  observationSchema,
  receiptSchema,
} from "./contracts.js";
import { hash } from "./storage.js";
import { Packs, checkConditions, applicable, resolveRoles } from "./packs.js";

export class Runtime {
  constructor(store, timeout = 10000) {
    this.store = store;
    this.packs = new Packs(store);
    this.timeout = timeout;
    this.session = null;
    this.binding = null;
    this.pending = null;
    this.observations = new Map();
    this.queue = Promise.resolve();
    this.fenced = false;
    this.cancelled = new Set();
    this.inFlight = new Map();
    this.children = new Map();
    this.lastPoll = 0;
  }
  bind(binding) {
    this.disconnect("browser-rebound");
    this.session = randomUUID();
    this.binding = binding;
    this.lastPoll = Date.now();
    this.fenced = false;
    return { session: this.session };
  }
  disconnect(reason = "browser-disconnected") {
    if (this.pending) this.pending.reject(Error(reason));
    this.pending = null;
    this.session = null;
    this.binding = null;
    this.observations.clear();
  }
  poll(session) {
    if (session !== this.session) throw Error("session-invalid-rebind");
    this.lastPoll = Date.now();
    if (!this.pending || this.pending.leased) return { command: null };
    this.pending.leased = true;
    return { command: this.pending.command };
  }
  reply(session, id, result) {
    if (
      session !== this.session ||
      !this.pending ||
      this.pending.command.id !== id ||
      !this.pending.leased
    )
      throw Error("late-or-unowned-reply");
    this.pending.resolve(result);
    this.pending = null;
    return { acknowledged: true };
  }
  async command(kind, args) {
    if (!this.session || !this.binding) throw Error("browser-not-bound");
    if (this.pending) throw Error("surface-busy");
    const session = this.session;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending?.command.id === command.id) this.pending = null;
        reject(Error("bridge-timeout-no-retry"));
      }, this.timeout);
      const command = {
        id: randomUUID(),
        session,
        kind,
        args,
        binding: this.binding,
        deadline: Date.now() + this.timeout,
      };
      this.pending = {
        command,
        leased: false,
        resolve: (r) => {
          clearTimeout(timer);
          resolve(r);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      };
    });
  }
  serial(fn) {
    const p = this.queue.then(fn);
    this.queue = p.catch(() => {});
    return p;
  }
  retain(value) {
    const observation = observationSchema.parse(value);
    if (
      observation.session !== this.session ||
      observation.surfaceId !== String(this.binding.tabId)
    )
      throw Error("observation-binding-mismatch");
    if (this.observations.has(observation.id))
      throw Error("observation-id-reused");
    this.observations.set(observation.id, structuredClone(observation));
    if (this.observations.size > 32)
      this.observations.delete(this.observations.keys().next().value);
    return structuredClone(observation);
  }
  observed(id) {
    const o = this.observations.get(id);
    if (!o || o.session !== this.session) throw Error("observation-expired");
    return structuredClone(o);
  }
  async observe(extra = []) {
    const selectors = [
      ...new Set([
        ...extra,
        ...Object.entries(this.store.data.packs).flatMap(([id, p]) =>
          [p.active, p.draft]
            .filter(Boolean)
            .flatMap((rev) =>
              this.packs
                .effective(id, rev)
                .roles.map((r) => r.locator.selector),
            ),
        ),
      ]),
    ];
    if (selectors.length > 256)
      throw Error("active-and-draft-selector-budget-exceeded");
    const result = await this.command("observe", { selectors });
    if (result.error) throw Error(result.error);
    return this.retain(result);
  }
  async act(value) {
    const a = actionSchema.parse(value),
      digest = hash(a),
      old = this.store.data.operations[a.operationId];
    if (old) {
      if (old.digest !== digest) throw Error("operation-id-conflict");
      return structuredClone(old.receipt);
    }
    const before = this.observed(a.observationId),
      target = before.nodes.find((n) => n.ref === a.target);
    if (!target) throw Error("target-not-observed");
    if (this.fenced) throw Error("surface-fenced-rebind-required");
    const session = this.session;
    await this.reserve(a.operationId, {
      digest,
      receipt: {
        accepted: true,
        delivery: "pending",
        outcome: "unknown",
        reason: "persisted-before-delivery",
      },
    });
    let receipt;
    try {
      if (this.cancelled.has(a.operationId))
        receipt = {
          accepted: true,
          delivery: "not-sent",
          outcome: "unknown",
          reason: "cancelled-before-delivery",
        };
      else {
        const r = await this.command("act", { action: a, before, target });
        receipt = receiptSchema.parse(r);
        if (receipt.after) receipt.after = this.retain(receipt.after);
        if (this.cancelled.has(a.operationId))
          receipt.reason += "; cancellation-requested-after-dispatch-possible";
      }
    } catch {
      receipt = {
        accepted: true,
        delivery: "unknown",
        outcome: "unknown",
        reason: "delivery-unconfirmed-no-retry",
      };
    }
    if (receipt.delivery === "unknown" && session === this.session)
      this.fenced = true;
    try {
      await this.store.change((s) => {
        s.operations[a.operationId].receipt = receipt;
      });
    } catch {
      if (session === this.session) this.fenced = true;
      throw Error(
        "receipt-persistence-failed-delivery-may-have-occurred-no-retry",
      );
    }
    return receipt;
  }
  async cancel(operationId) {
    if (!this.inFlight.has(operationId))
      return {
        operationId,
        cancelRequested: false,
        meaning:
          "not-running; inspect durable receipt; never retry unknown delivery",
      };
    this.cancelled.add(operationId);
    const child = this.children.get(operationId);
    if (child) this.cancelled.add(child);
    if (
      [operationId, child]
        .filter(Boolean)
        .includes(this.pending?.command.args.action?.operationId)
    ) {
      if (!this.pending.leased) {
        this.pending.resolve({
          accepted: true,
          delivery: "not-sent",
          outcome: "unknown",
          reason: "cancelled-before-lease",
        });
        this.pending = null;
      } else {
        this.fenced = true;
        this.pending.resolve({
          accepted: true,
          delivery: "unknown",
          outcome: "unknown",
          reason: "cancelled-after-lease-possible-delivery-no-retry",
        });
        this.pending = null;
      }
    }
    return {
      operationId,
      cancelRequested: true,
      meaning: "no-rollback; leased-input-may-already-be-delivered",
    };
  }
  async reserve(operationId, record) {
    return this.store.change((s) => {
      if (s.operations[operationId]) throw Error("operation-id-race");
      if (Object.keys(s.operations).length >= 10000)
        throw Error("operation-ledger-full-archive-offline-before-new-input");
      s.operations[operationId] = record;
    });
  }
  async runPack({ id, procedure, operationId, arguments: args = {} }) {
    const old = this.store.data.operations[operationId],
      intentDigest = hash({ id, procedure, operationId, arguments: args });
    if (old) {
      if (old.intentDigest !== intentDigest)
        throw Error("operation-id-conflict");
      return structuredClone(old.receipt);
    }
    const p = this.packs.get(id);
    if (!p.active) throw Error("pack-not-active");
    const pack = this.packs.effective(id, p.active),
      proc = pack.procedures.find((s) => s.id === procedure);
    if (!proc || pack.scope.origin === null)
      throw Error("origin-scoped-procedure-required");
    if (
      Object.keys(args).length !== proc.parameters.length ||
      proc.parameters.some((name) => !Object.hasOwn(args, name))
    )
      throw Error("procedure-arguments-mismatch");
    const effectiveRevision = hash(pack),
      digest = hash({ intentDigest, revision: p.active, effectiveRevision });
    const session = this.session;
    await this.reserve(operationId, {
      digest,
      intentDigest,
      revision: p.active,
      effectiveRevision,
      receipt: {
        accepted: true,
        delivery: "pending",
        outcome: "unknown",
        reason: "procedure-started",
      },
    });
    const steps = [];
    let outcome = "unknown",
      reason = "procedure-stopped";
    try {
      for (let i = 0; i < proc.steps.length; i++) {
        if (this.cancelled.has(operationId)) {
          reason = "procedure-cancelled";
          break;
        }
        const o = await this.observe(),
          roles = resolveRoles(pack, o);
        if (this.cancelled.has(operationId) || session !== this.session) {
          reason = "procedure-cancelled-or-session-changed";
          break;
        }
        if (
          !applicable(pack, o) ||
          checkConditions(pack.scope.conditions, roles).some(
            (c) => c.result !== "observed",
          ) ||
          (i === 0 &&
            checkConditions(proc.preconditions, roles).some(
              (c) => c.result !== "observed",
            ))
        ) {
          reason = "scope-or-initial-precondition-unconfirmed";
          break;
        }
        const step = proc.steps[i],
          role = roles[step.role];
        if (role?.status !== "matched") {
          reason = "step-target-unresolved-not-absent";
          break;
        }
        const node = role.nodes[0],
          child = hash([operationId, digest, i]).slice(0, 64);
        this.children.set(operationId, child);
        let result;
        try {
          result = await this.act({
            operationId: child,
            observationId: o.id,
            target: node.ref,
            kind: step.kind,
            ...(step.kind === "fill"
              ? {
                  text:
                    step.parameter !== undefined
                      ? args[step.parameter]
                      : step.text,
                  expectedValue: node.value ?? "",
                }
              : {}),
            ...(step.dy !== undefined ? { dy: step.dy } : {}),
            intent:
              step.kind === "fill"
                ? "edit-field"
                : step.kind === "scroll"
                  ? "scroll"
                  : "read-navigation",
          });
        } catch {
          result = {
            accepted: true,
            delivery: "unknown",
            outcome: "unknown",
            reason: "child-result-unconfirmed-no-retry",
          };
          if (session === this.session) this.fenced = true;
        } finally {
          this.children.delete(operationId);
          this.cancelled.delete(child);
        }
        steps.push(result);
        if (result.delivery !== "synthetic-dispatched") {
          reason = result.reason;
          break;
        }
        reason = "steps-dispatched";
      }
      if (
        !this.cancelled.has(operationId) &&
        session === this.session &&
        steps.length === proc.steps.length &&
        reason === "steps-dispatched" &&
        proc.postconditions.length
      ) {
        const after = await this.observe(),
          checks = applicable(pack, after)
            ? checkConditions(proc.postconditions, resolveRoles(pack, after))
            : [{ result: "unknown" }];
        outcome = checks.every((c) => c.result === "observed")
          ? "observed"
          : checks.some((c) => c.result === "unknown")
            ? "unknown"
            : "not-observed";
        reason = "postconditions-checked-no-causation-claim";
      }
    } catch (e) {
      reason = e.message;
    }
    const receipt = {
      accepted: true,
      delivery: steps.some((r) => r.delivery === "unknown")
        ? "unknown"
        : steps.some((r) => r.delivery === "synthetic-dispatched")
          ? "synthetic-dispatched"
          : "not-sent",
      outcome,
      reason,
      steps,
    };
    await this.store.change((s) => {
      s.operations[operationId].receipt = receipt;
    });
    return receipt;
  }
  async call(method, args) {
    const schema = Object.hasOwn(apiSchemas, method) && apiSchemas[method];
    if (!schema) throw Error("unknown-method");
    const a = schema.parse(args);
    if (method === "cancel") return this.cancel(a.operationId);
    if (method === "status")
      return {
        version: "0.1.0",
        connected: !!this.session && Date.now() - this.lastPoll < 5000,
        binding: this.binding,
        session: this.session,
        fenced: this.fenced,
        observations: this.observations.size,
      };
    if (method === "operation")
      return structuredClone(
        this.store.data.operations[a.operationId]?.receipt ?? {
          accepted: false,
          delivery: "not-sent",
          outcome: "unknown",
          reason: "operation-not-found",
        },
      );
    const operationId = ["act", "packRun"].includes(method)
      ? a.operationId
      : null;
    if (operationId) {
      if ([...this.inFlight.values()].reduce((a, b) => a + b, 0) >= 64)
        throw Error("operation-queue-full");
      this.inFlight.set(operationId, (this.inFlight.get(operationId) ?? 0) + 1);
    }
    try {
      return await this.serial(async () => {
        switch (method) {
          case "observe":
            return this.observe();
          case "act":
            return this.act(a);
          case "packs":
            return Object.entries(this.store.data.packs).map(([id, p]) => ({
              id,
              draft: p.draft,
              active: p.active,
              installed: p.installed,
            }));
          case "packGet":
            return this.packs.get(a.id);
          case "packDraft":
            return this.packs.draft(a.pack, a.expected);
          case "packImport": {
            const r = await this.packs.draft(a.pack, a.expected);
            await this.store.change((s) => {
              if (!s.packs[r.id].installed.includes(r.revision))
                s.packs[r.id].installed.push(r.revision);
            });
            return r;
          }
          case "packExport":
            return this.packs.definition(a.id, a.revision);
          case "packUpdatePreview":
            return this.packs.preview(a.id, a.pack);
          case "packPropose": {
            const o = this.observed(a.observationId),
              n = o.nodes.find((n) => n.ref === a.target);
            if (!n?.locator) throw Error("target-has-no-supported-locator");
            return this.packs.draft(
              {
                format: "paw-swu-pack",
                schemaVersion: 1,
                id: a.id,
                version: "0.1.0",
                name: a.name,
                scope: {
                  origin: new URL(o.url).origin,
                  pathPrefix: new URL(o.url).pathname,
                  conditions: [],
                },
                roles: [
                  {
                    id: "target",
                    locator: n.locator,
                    extract: n.href ? "link" : "text",
                  },
                ],
                permissions: ["read"],
                procedures: [],
              },
              null,
            );
          }
          case "packTest":
            return this.packs.recordTest(
              a.id,
              a.revision,
              await this.observe(),
            );
          case "packActivate":
            return this.packs.activate(a.id, a.revision, this.session);
          case "packContext":
            return this.packs.context(this.observed(a.observationId));
          case "packRun":
            return this.runPack(a);
        }
      });
    } finally {
      if (operationId) {
        const remaining = this.inFlight.get(operationId) - 1;
        if (remaining) this.inFlight.set(operationId, remaining);
        else {
          this.inFlight.delete(operationId);
          this.cancelled.delete(operationId);
        }
      }
    }
  }
}
