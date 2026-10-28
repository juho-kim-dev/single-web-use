import { packSchema } from "./contracts.js";
import { hash } from "./storage.js";
import { composeText, paginate } from "./reading.js";

export function applicable(pack, observation) {
  const u = new URL(observation.url);
  return (
    (pack.scope.origin === null || pack.scope.origin === u.origin) &&
    u.pathname.startsWith(pack.scope.pathPrefix)
  );
}
export function resolveRoles(pack, observation) {
  const roles = Object.create(null);
  for (const role of pack.roles) {
    const found = observation.nodes.filter(
      (n) =>
        (n.locator?.selector === role.locator.selector ||
          n.matches.includes(role.locator.selector)) &&
        (role.locator.label === undefined || n.label === role.locator.label),
    );
    const selected = found.slice(
      0,
      role.cardinality === "many" ? (role.limit ?? 50) : 300,
    );
    const nodes =
      selected.length === 1
        ? selected.map((n) => ({ ...n, reading: composeText(observation, n) }))
        : selected;
    roles[role.id] = {
      status:
        found.length && role.cardinality === "many"
          ? "matched"
          : nodes.length === 1
            ? "matched"
            : nodes.length
              ? "ambiguous"
              : "not-observed",
      nodes,
      totalObserved: found.length,
      truncated: found.length > nodes.length || observation.coverage.truncated,
    };
  }
  return roles;
}
export function checkConditions(conditions, roles) {
  return conditions.map((c) => {
    const role = roles[c.role],
      n =
        role?.status === "matched" &&
        !role.truncated &&
        role.totalObserved === 1 &&
        role.nodes.length === 1 &&
        role.nodes[0];
    const result =
      !n ||
      (c.state === "value" && n.value === null) ||
      (c.state === "text" &&
        (n.reading?.truncated ||
          n.reading?.omitted ||
          n.textEvidence.truncated ||
          n.textEvidence.omitted))
        ? "unknown"
        : c.state === "visible"
          ? n.exposure === "hit-tested"
            ? "observed"
            : "unknown"
          : c.state === "enabled"
            ? !n.disabled
              ? "observed"
              : "not-observed"
            : (c.state === "text"
                  ? (n.reading?.text ?? n.text)
                  : n[c.state]) === c.equals
              ? "observed"
              : "not-observed";
    return { ...c, result };
  });
}
export function assess(pack, observation, revision = null) {
  const roles = resolveRoles(pack, observation),
    conditions = checkConditions(pack.scope.conditions, roles);
  const extraction = pack.roles.map((role) => {
    const match = roles[role.id];
    return {
      role: role.id,
      mode: role.extract,
      status: match.status,
      truncated: match.truncated,
      totalObserved: match.totalObserved,
      continuation: revision
        ? {
            method: "read",
            args: {
              observationId: observation.id,
              packId: pack.id,
              packRevision: revision,
              effectiveRevision: hash(pack),
              roles: [role.id],
              offset: 0,
            },
          }
        : null,
      observationId: observation.id,
    };
  });
  return {
    inScope: applicable(pack, observation),
    roles: Object.fromEntries(
      Object.entries(roles).map(([id, role]) => [
        id,
        {
          status: role.status,
          totalObserved: role.totalObserved,
          truncated: role.truncated,
          refs: role.nodes.slice(0, 16).map((n) => n.ref),
          refsTruncated:
            role.nodes.length > 16 || role.totalObserved > role.nodes.length,
        },
      ]),
    ),
    extraction,
    coverage: observation.coverage,
    evidenceRead: {
      method: "observationRead",
      args: { observationId: observation.id },
    },
    inputPermission: false,
    currentAtRead: "not-checked",
    conditions,
    pass:
      applicable(pack, observation) &&
      Object.values(roles).every((r) => r.status === "matched") &&
      conditions.every((c) => c.result === "observed"),
  };
}
export class Packs {
  constructor(store) {
    this.store = store;
  }
  get(id) {
    const p = this.store.data.packs[id];
    if (!p) throw Error("pack-not-found");
    return structuredClone(p);
  }
  definition(id, revision) {
    const p = this.get(id),
      value = p.revisions[revision];
    if (!value) throw Error("revision-not-found");
    return packSchema.parse(value);
  }
  exportDefinition(id, revision) {
    this.definition(id, revision);
    return structuredClone(this.get(id).revisions[revision]);
  }
  effective(id, revision) {
    const pack = this.definition(id, revision);
    return this.compose(pack);
  }
  compose(pack) {
    if (!pack.extends) return pack;
    const base = this.definition(pack.extends.id, pack.extends.revision);
    if (base.extends) throw Error("nested-overlays-unsupported");
    if (
      (base.scope.origin !== null && base.scope.origin !== pack.scope.origin) ||
      !pack.scope.pathPrefix.startsWith(base.scope.pathPrefix)
    )
      throw Error("overlay-scope-widening");
    if (
      pack.roles.some(
        (role) =>
          base.scope.conditions.some((c) => c.role === role.id) &&
          hash(role) !== hash(base.roles.find((r) => r.id === role.id)),
      )
    )
      throw Error("overlay-cannot-replace-base-scope-condition-role");
    const roles = new Map(base.roles.map((r) => [r.id, r]));
    for (const r of pack.roles) roles.set(r.id, r);
    const procedures = new Map(base.procedures.map((r) => [r.id, r]));
    for (const r of pack.procedures) procedures.set(r.id, r);
    // Clearing extends makes the schema validate all references against the effective roles.
    const effective = packSchema.parse({
      ...pack,
      extends: undefined,
      scope: {
        ...pack.scope,
        conditions: [...base.scope.conditions, ...pack.scope.conditions],
      },
      roles: [...roles.values()],
      procedures: [...procedures.values()],
    });
    return effective;
  }
  async draft(value, expected) {
    const pack = packSchema.parse(value),
      revision = hash(pack);
    if (pack.extends) {
      if (pack.extends.id === pack.id) throw Error("self-overlay");
      this.definition(pack.extends.id, pack.extends.revision);
    }
    this.compose(pack);
    return this.store.change((s) => {
      const p = s.packs[pack.id] ?? {
        draft: null,
        active: null,
        revisions: {},
        created: {},
        tests: {},
        installed: [],
      };
      if (p.draft !== expected) throw Error("draft-conflict-reload-required");
      p.revisions[revision] = pack;
      p.created[revision] ??= Date.now();
      p.draft = revision;
      s.packs[pack.id] = p;
      return { id: pack.id, revision, active: p.active };
    });
  }
  async recordTest(id, revision, observation) {
    const p = this.get(id);
    if (p.draft !== revision) throw Error("test-requires-current-draft");
    if (observation.at <= p.created[revision])
      throw Error("new-observation-required");
    const context = assess(this.effective(id, revision), observation, revision);
    const report = {
      ...context,
      pass:
        context.inScope &&
        context.conditions.every((c) => c.result === "observed") &&
        Object.values(context.roles).some((r) => r.status === "matched"),
      meaning:
        "locator-test-only; unresolved/future roles remain unverified; procedure outcomes not tested",
      revision,
      observationId: observation.id,
      session: observation.session,
      at: Date.now(),
      addedPermissions: this.addedPermissions(id, revision),
    };
    return this.store.change((s) => {
      // Keep validation metadata, not an unbounded automatic archive of captured page text.
      const stored = {
        ...report,
      };
      s.packs[id].tests[revision] = stored;
      return stored;
    });
  }
  addedPermissions(id, revision) {
    const p = this.get(id),
      pack = this.definition(id, revision);
    const reference = pack.extends
      ? this.definition(pack.extends.id, pack.extends.revision).permissions
      : p.active
        ? this.effective(id, p.active).permissions
        : ["read"];
    return pack.permissions.filter((p) => !reference.includes(p));
  }
  async activate(id, revision, session, acknowledgePermissions = []) {
    const added = this.addedPermissions(id, revision);
    return this.store.change((s) => {
      const p = s.packs[id],
        t = p?.tests[revision];
      if (
        p?.draft !== revision ||
        !t?.pass ||
        t.session !== session ||
        Date.now() - t.at > 300000
      )
        throw Error("fresh-passing-test-required");
      if (added.some((p) => !acknowledgePermissions.includes(p)))
        throw Error(
          "explicit-permission-acknowledgement-required:" + added.join(","),
        );
      p.active = revision;
      p.permissionAcknowledgements ??= {};
      p.permissionAcknowledgements[revision] = [...acknowledgePermissions];
      return { id, active: revision };
    });
  }
  async deactivate(id, expected) {
    return this.store.change((s) => {
      const p = s.packs[id];
      if (!p || p.active !== expected) throw Error("active-revision-conflict");
      p.active = null;
      return { id, active: null, preserved: true };
    });
  }
  context(observation, options = { offset: 0, limit: 4, maxBytes: 65536 }) {
    const candidates = [];
    for (const [id, p] of Object.entries(this.store.data.packs))
      if (p.active) {
        const pack = this.effective(id, p.active);
        if (applicable(pack, observation)) candidates.push({ id, p, pack });
      }
    const projected = paginate(candidates, options, ({ id, p, pack }) => ({
      id,
      revision: p.active,
      name: pack.name,
      ...assess(pack, observation, p.active),
      procedures: pack.procedures.map((p) => p.id),
      evidence: "roles-inferred-from-pack; nodes-original-dom",
    }));
    const matches = projected.items;
    const owners = {};
    for (const p of matches)
      for (const r of Object.keys(p.roles)) (owners[r] ??= []).push(p.id);
    return {
      matches,
      page: projected.page,
      continuation:
        projected.page.nextOffset === null
          ? null
          : {
              method: "packContext",
              args: {
                ...options,
                observationId: observation.id,
                offset: projected.page.nextOffset,
              },
            },
      conflictScope: "returned-pack-page-only",
      inputPermission: false,
      conflicts: Object.entries(owners)
        .filter(([, v]) => v.length > 1)
        .map(([role, packs]) => ({ role, packs })),
      meaning: "not-observed-is-not-absent; recheck-before-input",
    };
  }
  preview(id, value) {
    const incoming = packSchema.parse(value),
      p = this.get(id),
      current = this.definition(id, p.draft ?? p.active);
    if (incoming.id !== id) throw Error("update-id-mismatch");
    const conflicts = [];
    for (const field of [
      "scope",
      "roles",
      "procedures",
      "permissions",
      "extends",
    ])
      if (JSON.stringify(current[field]) !== JSON.stringify(incoming[field]))
        conflicts.push({
          field,
          current: current[field] ?? null,
          incoming: incoming[field] ?? null,
        });
    const overlays = Object.entries(this.store.data.packs)
      .filter(([, v]) =>
        Object.values(v.revisions).some((r) => r.extends?.id === id),
      )
      .map(([id]) => id);
    return {
      id,
      currentRevision: p.draft ?? p.active,
      incomingRevision: hash(incoming),
      addedPermissions: incoming.permissions.filter(
        (permission) =>
          !(
            incoming.extends
              ? this.definition(incoming.extends.id, incoming.extends.revision)
                  .permissions
              : current.permissions
          ).includes(permission),
      ),
      conflicts,
      overlays,
      automaticMerge: false,
      next: "save-as-draft-with-expected-revision; retest; explicitly-activate; overlays-stay-pinned",
    };
  }
}
