import { randomUUID } from "node:crypto";
import {
  actionSchema,
  apiSchemas,
  observationSchema,
  receiptSchema,
  readOptions,
} from "./contracts.js";
import { hash } from "./storage.js";
import { Packs, checkConditions, applicable, resolveRoles } from "./packs.js";
import { inside, itemFor, paginate, diffObservations } from "./reading.js";
import { ReadingDocuments } from "./documents.js";
import { navigationDestination, observeArrival } from "./arrival.js";

export class Runtime {
  constructor(store, timeout = 10000) {
    this.store = store;
    this.packs = new Packs(store);
    this.documents = new ReadingDocuments(store);
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
    this.paused = store.data.paused === true;
    this.pauseEpoch = 0;
    this.invalidated = new Set();
    this.controlQueue = Promise.resolve();
  }
  setPaused(paused) {
    if (paused) {
      this.paused = true;
      this.pauseEpoch++;
      this.invalidated = new Set(this.observations.keys());
      for (const id of this.inFlight.keys()) void this.cancel(id);
      if (this.pending?.command.kind === "observe") {
        this.pending.reject(Error("runtime-paused"));
        this.pending = null;
      }
    }
    const epoch = this.pauseEpoch;
    const result = this.controlQueue.then(async () => {
      await this.store.change((s) => {
        s.paused = paused;
      });
      if (!paused && epoch === this.pauseEpoch) this.paused = false;
      return {
        paused: this.paused,
        persisted: paused,
        fenced: this.fenced,
        meaning:
          "no-rollback; unknown-delivery-fence-remains; fresh-observation-required",
      };
    });
    this.controlQueue = result.catch(() => {});
    return result;
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
  async command(kind, args, timeout = this.timeout, operationId = null) {
    if (this.paused) throw Error("runtime-paused");
    if (!this.session || !this.binding) throw Error("browser-not-bound");
    if (this.pending) throw Error("surface-busy");
    const session = this.session;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending?.command.id === command.id) this.pending = null;
        reject(Error("bridge-timeout-no-retry"));
      }, timeout);
      const command = {
        id: randomUUID(),
        session,
        kind,
        args,
        binding: this.binding,
        deadline: Date.now() + timeout,
      };
      this.pending = {
        operationId,
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
  retain(value, pauseEpoch = this.pauseEpoch) {
    const observation = observationSchema.parse(value);
    if (
      observation.session !== this.session ||
      observation.surfaceId !== String(this.binding.tabId)
    )
      throw Error("observation-binding-mismatch");
    if (this.observations.has(observation.id))
      throw Error("observation-id-reused");
    if (Buffer.byteLength(JSON.stringify(observation)) > 2 * 1024 * 1024)
      throw Error("observation-byte-budget-exceeded");
    this.observations.set(observation.id, structuredClone(observation));
    if (this.paused || pauseEpoch !== this.pauseEpoch)
      this.invalidated.add(observation.id);
    while (
      this.observations.size > 32 ||
      [...this.observations.values()].reduce(
        (sum, o) => sum + Buffer.byteLength(JSON.stringify(o)),
        0,
      ) >
        16 * 1024 * 1024
    ) {
      const oldest = this.observations.keys().next().value;
      this.observations.delete(oldest);
      this.invalidated.delete(oldest);
    }
    return structuredClone(observation);
  }
  observed(id) {
    const o = this.observations.get(id);
    if (!o || o.session !== this.session) throw Error("observation-expired");
    if (this.invalidated.has(id))
      throw Error("observation-invalidated-by-pause");
    return structuredClone(o);
  }
  retained(id) {
    const o = this.observations.get(id);
    if (!o) throw Error("observation-not-retained");
    return structuredClone(o);
  }
  async observe(extra = [], timeout = this.timeout, operationId = null) {
    const pauseEpoch = this.pauseEpoch;
    const selectors = [
      ...new Set([
        ...extra,
        ...Object.entries(this.store.data.packs).flatMap(([id, p]) =>
          [p.active]
            .filter(Boolean)
            .flatMap((rev) =>
              this.packs
                .effective(id, rev)
                .roles.map((r) => r.locator.selector),
            ),
        ),
      ]),
    ];
    if (selectors.length > 256) throw Error("active-selector-budget-exceeded");
    const result = await this.command(
      "observe",
      { selectors },
      timeout,
      operationId,
    );
    if (result.error) throw Error(result.error);
    return this.retain(result, pauseEpoch);
  }
  read(observationId, value) {
    const options = readOptions.parse(value),
      o = this.retained(observationId),
      nodes = new Map(o.nodes.map((n) => [n.ref, n]));
    if (options.within && !nodes.has(options.within))
      throw Error("reading-root-not-observed");
    let items = [],
      roles = [];
    if (options.packId) {
      const p = this.packs.get(options.packId);
      const revision = options.packRevision ?? p.active;
      if (!revision) throw Error("pack-not-active");
      const pack = this.packs.effective(options.packId, revision),
        effectiveRevision = hash(pack);
      if (
        options.effectiveRevision &&
        options.effectiveRevision !== effectiveRevision
      )
        throw Error("reading-effective-revision-mismatch");
      options.packRevision = revision;
      options.effectiveRevision = effectiveRevision;
      if (!pack.permissions.includes("read") || !applicable(pack, o))
        throw Error("pack-reading-out-of-scope-or-permission");
      const resolved = resolveRoles(pack, o);
      if (
        checkConditions(pack.scope.conditions, resolved).some(
          (c) => c.result !== "observed",
        )
      )
        throw Error("pack-scope-conditions-unconfirmed");
      if (options.roles?.some((id) => !pack.roles.some((r) => r.id === id)))
        throw Error("unknown-reading-role");
      for (const role of pack.roles.filter(
        (r) => !options.roles || options.roles.includes(r.id),
      )) {
        const match = resolved[role.id];
        roles.push({
          id: role.id,
          status: match.status,
          totalObserved: match.totalObserved,
          truncated: match.truncated,
        });
        if (match.status === "matched" && options.kinds.includes(role.extract))
          items.push(
            ...match.nodes.map((n) => ({
              ref: n.ref,
              mode: role.extract,
              role: role.id,
            })),
          );
      }
    } else {
      if (options.packRevision || options.effectiveRevision)
        throw Error("revision-requires-pack-id");
      if (options.roles) throw Error("roles-require-pack-id");
      for (const node of o.nodes)
        for (const mode of options.kinds)
          if (mode !== "link" || node.href)
            items.push({ ref: node.ref, mode, role: null });
    }
    if (options.within)
      items = items.filter((item) =>
        inside(nodes.get(item.ref), options.within, nodes),
      );
    const page = paginate(items, options, (item) =>
      itemFor(o, nodes.get(item.ref), item.mode, item.role),
    );
    return {
      observationId: o.id,
      provenance: {
        origin: new URL(o.url).origin,
        url: o.url,
        surfaceId: o.surfaceId,
        session: o.session,
        documentId: o.documentId,
        generation: o.generation,
        observationId: o.id,
        at: o.at,
        coverage: o.coverage,
      },
      ...page,
      roles,
      filter: options,
      currentAtRead: "not-checked",
      inputPermission: false,
      meaning: "retained-bounded-evidence; metadata-is-not-visible-reading",
      continuation:
        page.page.nextOffset === null
          ? null
          : {
              method: "read",
              args: {
                ...options,
                observationId: o.id,
                offset: page.page.nextOffset,
              },
            },
    };
  }
  capabilities(observationId, purpose) {
    const o = observationId ? this.retained(observationId) : null;
    const connected = !!this.session && Date.now() - this.lastPoll < 5000;
    const primitives = ["fill", "click", "scroll"].map((kind) => ({
      kind,
      input: "DOM-synthetic",
      supported: true,
      limits:
        kind === "fill"
          ? "native text/search/textarea with exact expected value"
          : kind === "click"
            ? "ordinary same-tab HTTP(S) links only"
            : "bounded scrollable element",
      blockedReasons: [
        ...(!connected ? ["browser-not-connected"] : []),
        ...(this.fenced ? ["surface-fenced"] : []),
        ...(this.paused ? ["runtime-paused"] : []),
      ],
      requires: "fresh-foreground-observation-and-immediate-target-guard",
    }));
    const procedures = [];
    for (const [id, p] of Object.entries(this.store.data.packs))
      if (p.active) {
        const pack = this.packs.effective(id, p.active),
          roles = o ? resolveRoles(pack, o) : null;
        for (const proc of pack.procedures) {
          const blockedReasons = [];
          if (!o) blockedReasons.push("observation-required");
          else {
            if (o.session !== this.session)
              blockedReasons.push("observation-from-prior-binding");
            if (this.invalidated.has(o.id))
              blockedReasons.push("observation-invalidated-by-pause");
            if (!applicable(pack, o)) blockedReasons.push("scope-mismatch");
            if (
              checkConditions(
                [...pack.scope.conditions, ...proc.preconditions],
                roles,
              ).some((c) => c.result !== "observed")
            )
              blockedReasons.push("scope-or-initial-conditions-unconfirmed");
            const target = roles[proc.steps[0].role];
            if (target?.truncated)
              blockedReasons.push("target-search-truncated");
            if (target?.status !== "matched")
              blockedReasons.push("initial-target-unresolved");
            else if (target.nodes.length !== 1)
              blockedReasons.push(
                proc.steps[0].linkParameter
                  ? "exact-link-argument-required"
                  : "initial-target-ambiguous",
              );
          }
          if (pack.scope.origin === null)
            blockedReasons.push(
              "global-action-procedure-requires-site-overlay",
            );
          if (!connected) blockedReasons.push("browser-not-connected");
          if (this.fenced) blockedReasons.push("surface-fenced");
          if (this.paused) blockedReasons.push("runtime-paused");
          procedures.push({
            packId: id,
            revision: p.active,
            id: proc.id,
            parameters: {
              type: "object",
              properties: Object.fromEntries(
                proc.parameters.map((name) => [
                  name,
                  { type: "string", maxLength: 4000 },
                ]),
              ),
              required: proc.parameters,
              additionalProperties: false,
            },
            blockedReasons,
            ...(proc.arrival
              ? {
                  arrival: proc.arrival,
                  arrivalDestination: "exact-selected-same-origin-href",
                }
              : {}),
            applicability: o ? "checked-at-retained-observation" : "unexamined",
            currentAtRead: "not-checked",
          });
        }
      }
    const read = [
      "observe",
      "read",
      "observationRead",
      "observationHistory",
      "observationDiff",
      "contentRead",
      "contentList",
      "documentRead",
      "documentList",
      "documentExport",
      "capabilities",
    ];
    const act = ["act", "packRun", "cancel", "operation"];
    return {
      primitives: purpose === "read" || purpose === "manage" ? [] : primitives,
      procedures: purpose === "read" || purpose === "manage" ? [] : procedures,
      commands: Object.keys(apiSchemas).filter(
        (name) =>
          purpose === "all" ||
          (purpose === "read"
            ? read.includes(name)
            : purpose === "act"
              ? act.includes(name)
              : !read.includes(name) && !act.includes(name)),
      ),
      inputPermission: false,
      limits: [
        "discovery-is-not-authorization",
        "retained-evidence-is-not-current-input-proof",
      ],
    };
  }
  async act(value) {
    const a = actionSchema.parse(value),
      digest = hash(a),
      old = this.store.data.operations[a.operationId];
    if (old) {
      if (old.digest !== digest) throw Error("operation-id-conflict");
      return structuredClone(old.receipt);
    }
    if (this.paused) throw Error("runtime-paused");
    const before = this.observed(a.observationId),
      target = before.nodes.find((n) => n.ref === a.target);
    if (!target) throw Error("target-not-observed");
    if (this.fenced) throw Error("surface-fenced-rebind-required");
    const session = this.session;
    const pauseEpoch = this.pauseEpoch;
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
      else if (session !== this.session || this.fenced || this.paused)
        receipt = {
          accepted: true,
          delivery: "not-sent",
          outcome: "unknown",
          reason: "binding-or-fence-changed-before-delivery",
        };
      else {
        const r = await this.command("act", { action: a, before, target });
        receipt = receiptSchema.parse(r);
        if (receipt.after)
          receipt.after = this.retain(receipt.after, pauseEpoch);
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
    if (
      this.pending?.operationId === operationId &&
      this.pending.command.kind === "observe"
    ) {
      this.pending.reject(Error("arrival-cancelled"));
      this.pending = null;
    }
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
    if (this.paused) throw Error("runtime-paused");
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
    let navigation = null,
      arrival = null;
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
        const candidates =
          role?.nodes.filter(
            (n) =>
              step.linkParameter === undefined ||
              n.href === args[step.linkParameter],
          ) ?? [];
        if (
          role?.status !== "matched" ||
          role.truncated ||
          candidates.length !== 1
        ) {
          reason = role?.truncated
            ? "target-search-truncated"
            : "step-target-unresolved-not-absent";
          break;
        }
        const node = candidates[0],
          child = hash([operationId, digest, i]).slice(0, 64);
        if (proc.arrival && i === proc.steps.length - 1)
          navigation = {
            source: o,
            destination: navigationDestination(o, node.href),
          };
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
        navigation &&
        steps.length === proc.steps.length &&
        steps.at(-1).delivery !== "not-sent"
      ) {
        arrival = await observeArrival(this, {
          ...navigation,
          pack,
          rule: proc.arrival,
          operationId,
        });
        reason = arrival.reason;
        if (
          arrival.status === "arrived" &&
          steps.every((s) => s.delivery === "synthetic-dispatched")
        )
          outcome = "observed";
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
      ...(arrival ? { arrival } : {}),
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
    if (method === "pause") return this.setPaused(a.paused);
    if (method === "cancel") return this.cancel(a.operationId);
    if (method === "status")
      return {
        version: "0.4.0",
        connected: !!this.session && Date.now() - this.lastPoll < 5000,
        binding: this.binding,
        session: this.session,
        fenced: this.fenced,
        paused: this.paused,
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
    const pauseEpoch = this.pauseEpoch;
    const requestedWhilePaused = this.paused;
    const liveRequest =
      ["observe", "act", "packRun", "packTest"].includes(method) ||
      (method === "read" && !a.observationId);
    if (operationId) {
      if ([...this.inFlight.values()].reduce((a, b) => a + b, 0) >= 64)
        throw Error("operation-queue-full");
      this.inFlight.set(operationId, (this.inFlight.get(operationId) ?? 0) + 1);
    }
    try {
      return await this.serial(async () => {
        if (
          liveRequest &&
          (requestedWhilePaused || pauseEpoch !== this.pauseEpoch) &&
          !(operationId && this.store.data.operations[operationId])
        )
          throw Error("request-invalidated-by-pause");
        switch (method) {
          case "observe": {
            const o = await this.observe();
            return a.read ? this.read(o.id, a.read) : o;
          }
          case "read": {
            const { observationId, ...filter } = a;
            const o = observationId
              ? this.retained(observationId)
              : await this.observe();
            return this.read(o.id, filter);
          }
          case "capabilities":
            return this.capabilities(a.observationId, a.purpose);
          case "observationRead":
            return {
              observation: this.retained(a.observationId),
              currentAtRead: "not-checked",
              inputPermission: false,
            };
          case "observationHistory":
            return {
              observations: [...this.observations.values()].map(
                ({
                  id,
                  surfaceId,
                  session,
                  documentId,
                  url,
                  at,
                  coverage,
                }) => ({
                  id,
                  surfaceId,
                  session,
                  documentId,
                  url,
                  at,
                  coverage,
                }),
              ),
              retention: { count: 32, maxBytes: 16 * 1024 * 1024 },
              inputPermission: false,
            };
          case "observationDiff":
            return diffObservations(
              this.retained(a.before),
              this.retained(a.after),
            );
          case "contentSave": {
            const reading = this.read(a.observationId, a.read),
              id = randomUUID(),
              entry = { id, name: a.name, savedAt: Date.now(), reading };
            if (Buffer.byteLength(JSON.stringify(entry)) > 524288)
              throw Error("saved-content-entry-too-large");
            return this.store.change((s) => {
              s.contents ??= {};
              if (Object.keys(s.contents).length >= 64)
                throw Error("saved-content-count-limit");
              const contents = { ...s.contents, [id]: entry };
              if (Buffer.byteLength(JSON.stringify(contents)) > 8 * 1024 * 1024)
                throw Error("saved-content-byte-limit");
              s.contents = contents;
              return {
                id,
                name: a.name,
                provenance: reading.provenance,
                savedAt: entry.savedAt,
              };
            });
          }
          case "contentList":
            return Object.values(this.store.data.contents ?? {}).map(
              ({ id, name, savedAt, reading }) => ({
                id,
                name,
                savedAt,
                provenance: reading.provenance,
              }),
            );
          case "contentRead": {
            const entry = this.store.data.contents?.[a.id];
            if (!entry) throw Error("saved-content-not-found");
            return {
              ...structuredClone(entry),
              currentAtRead: "not-checked",
              inputPermission: false,
            };
          }
          case "documentCreate":
            return this.documents.create(a);
          case "documentAppend":
            return this.documents.append(a);
          case "documentList":
            return this.documents.list();
          case "documentRead":
            return this.documents.read(a.id);
          case "documentExport":
            return this.documents.export(a.id);
          case "act":
            return this.act(a);
          case "packs":
            return Object.entries(this.store.data.packs).map(([id, p]) => ({
              id,
              draft: p.draft,
              active: p.active,
              installed: p.installed,
              archived: !!p.archivedAt,
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
            return this.packs.exportDefinition(a.id, a.revision);
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
              await this.observe(
                this.packs
                  .effective(a.id, a.revision)
                  .roles.map((r) => r.locator.selector),
              ),
            );
          case "packActivate":
            return this.packs.activate(
              a.id,
              a.revision,
              this.session,
              a.acknowledgePermissions,
            );
          case "packDeactivate":
            return this.packs.deactivate(a.id, a.expected);
          case "packArchive":
            return this.packs.archive(a.id, a.expected, a.expectedActive);
          case "packUnarchive":
            return this.packs.unarchive(a.id, a.expected);
          case "packRestore":
            return this.packs.restore(a.id, a.expected, a.revision);
          case "packContext":
            return this.packs.context(this.retained(a.observationId), a);
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
