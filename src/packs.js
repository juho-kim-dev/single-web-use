import { packSchema } from "./contracts.js";
import { hash } from "./storage.js";

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
    const nodes = observation.nodes.filter(
      (n) =>
        (n.locator?.selector === role.locator.selector ||
          n.matches.includes(role.locator.selector)) &&
        (role.locator.label === undefined || n.label === role.locator.label),
    );
    roles[role.id] = {
      status:
        nodes.length === 1
          ? "matched"
          : nodes.length
            ? "ambiguous"
            : "not-observed",
      nodes,
    };
  }
  return roles;
}
export function checkConditions(conditions, roles) {
  return conditions.map((c) => {
    const role = roles[c.role],
      n = role?.nodes.length === 1 && role.nodes[0];
    const result =
      !n ||
      (c.state === "value" && n.value === null) ||
      (c.state === "text" &&
        (n.textEvidence.truncated || n.textEvidence.omitted))
        ? "unknown"
        : c.state === "visible"
          ? n.exposure === "hit-tested"
            ? "observed"
            : "unknown"
          : c.state === "enabled"
            ? !n.disabled
              ? "observed"
              : "not-observed"
            : n[c.state] === c.equals
              ? "observed"
              : "not-observed";
    return { ...c, result };
  });
}
export function assess(pack, observation) {
  const roles = resolveRoles(pack, observation),
    conditions = checkConditions(pack.scope.conditions, roles);
  const extraction = pack.roles.map((role) => {
    const match = roles[role.id],
      node = match.status === "matched" ? match.nodes[0] : null;
    return {
      role: role.id,
      mode: role.extract,
      status: match.status,
      value: !node
        ? null
        : role.extract === "text"
          ? { text: node.text, evidence: node.textEvidence }
          : role.extract === "link"
            ? {
                href: node.href,
                evidence: "DOM-link-metadata-not-navigation-proof",
              }
            : {
                disabled: node.disabled,
                editable: node.editable,
                states: node.states,
                value: node.value,
              },
      observationId: observation.id,
    };
  });
  return {
    inScope: applicable(pack, observation),
    roles,
    extraction,
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
  effective(id, revision) {
    const pack = this.definition(id, revision);
    return this.compose(pack);
  }
  compose(pack) {
    if (!pack.extends) return pack;
    const base = this.definition(pack.extends.id, pack.extends.revision);
    if (base.extends) throw Error("nested-overlays-unsupported");
    if (
      base.scope.origin !== pack.scope.origin ||
      !pack.scope.pathPrefix.startsWith(base.scope.pathPrefix)
    )
      throw Error("overlay-scope-widening");
    if (pack.permissions.some((p) => !base.permissions.includes(p)))
      throw Error("overlay-permission-widening");
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
    const context = assess(this.effective(id, revision), observation);
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
    };
    return this.store.change((s) => {
      s.packs[id].tests[revision] = report;
      return report;
    });
  }
  async activate(id, revision, session) {
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
      p.active = revision;
      return { id, active: revision };
    });
  }
  context(observation) {
    const matches = [];
    for (const [id, p] of Object.entries(this.store.data.packs))
      if (p.active) {
        const pack = this.effective(id, p.active);
        if (applicable(pack, observation))
          matches.push({
            id,
            revision: p.active,
            name: pack.name,
            ...assess(pack, observation),
            procedures: pack.procedures.map((p) => p.id),
            evidence: "roles-inferred-from-pack; nodes-original-dom",
          });
      }
    const owners = {};
    for (const p of matches)
      for (const r of Object.keys(p.roles)) (owners[r] ??= []).push(p.id);
    return {
      matches,
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
      currentRevision: hash(current),
      incomingRevision: hash(incoming),
      conflicts,
      overlays,
      automaticMerge: false,
      next: "save-as-draft-with-expected-revision; retest; explicitly-activate; overlays-stay-pinned",
    };
  }
}
