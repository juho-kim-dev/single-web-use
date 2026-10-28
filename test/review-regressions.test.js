import test from "node:test";
import assert from "node:assert/strict";
import { writeFile, readFile, readdir } from "node:fs/promises";
import { pack, observation, fixture, pending, tick } from "./helpers.js";
import { id, packSchema } from "../src/contracts.js";
import { checkConditions, resolveRoles } from "../src/packs.js";

test("unsupported values stay unknown and overlays cannot replace base scope condition roles", async (t) => {
  const { runtime } = await fixture(t),
    base = pack();
  base.scope.conditions = [{ role: "search", state: "enabled" }];
  const r = await runtime.packs.draft(base, null),
    o = observation();
  o.nodes[0].value = null;
  assert.equal(
    checkConditions(
      [{ role: "search", state: "value", equals: "" }],
      resolveRoles(base, o),
    )[0].result,
    "unknown",
  );
  const overlay = pack({
    id: "scope-override",
    extends: { id: base.id, revision: r.revision },
    roles: [{ id: "search", locator: { selector: "#other" }, extract: "text" }],
  });
  await assert.rejects(
    runtime.packs.draft(overlay, null),
    /scope-condition-role/,
  );
});

test("child receipt save failure after dispatch stays unknown in parent and fences later input", async (t) => {
  const { runtime, store, session } = await fixture(t, 500),
    p = pack(),
    r = await runtime.packs.draft(p, null);
  await store.change((s) => {
    s.packs[p.id].active = r.revision;
  });
  const save = store.change.bind(store);
  let mutations = 0;
  store.change = async (fn) => {
    if (++mutations === 3) throw Error("injected-receipt-save-failure");
    return save(fn);
  };
  const run = runtime.call("packRun", {
    id: p.id,
    procedure: "query",
    operationId: "save-failure",
  });
  let c = await pending(runtime);
  runtime.reply(session, c.id, observation({ session }));
  c = await pending(runtime);
  runtime.reply(session, c.id, {
    accepted: true,
    delivery: "synthetic-dispatched",
    outcome: "unknown",
    reason: "fixture",
  });
  const result = await run;
  assert.equal(result.delivery, "unknown");
  assert.equal(result.steps[0].delivery, "unknown");
  assert.equal(runtime.fenced, true);
  assert.equal(runtime.pending, null);
});

test("prototype names and duplicate parameter/role IDs are rejected at every public boundary", async (t) => {
  const { runtime } = await fixture(t);
  for (const name of ["__proto__", "constructor", "toString", "prototype"]) {
    assert.throws(() => id.parse(name));
    await assert.rejects(runtime.call("operation", { operationId: name }));
    await assert.rejects(
      runtime.call("packDraft", { pack: pack({ id: name }), expected: null }),
    );
  }
  await assert.rejects(runtime.call("constructor", {}), /unknown-method/);
  const duplicate = pack();
  duplicate.roles.push(duplicate.roles[0]);
  assert.throws(() => packSchema.parse(duplicate));
  const params = pack();
  params.procedures[0].parameters = ["q", "q"];
  assert.throws(() => packSchema.parse(params));
});
test("initial preconditions run once, unrelated/future roles may be unobserved, named arguments bind pinned intent", async (t) => {
  const { runtime, session, store } = await fixture(t, 500),
    p = pack();
  p.roles.push({
    id: "unrelated",
    locator: { selector: "#later" },
    extract: "text",
  });
  p.procedures[0] = {
    id: "query",
    parameters: ["query"],
    preconditions: [{ role: "search", state: "value", equals: "" }],
    postconditions: [{ role: "search", state: "value", equals: "second" }],
    steps: [
      { kind: "fill", role: "search", parameter: "query" },
      { kind: "fill", role: "search", text: "second" },
    ],
  };
  const draft = await runtime.packs.draft(p, null);
  await store.change((s) => {
    s.packs[p.id].active = draft.revision;
  }); // Isolate execution from lifecycle role-test policy.
  const request = {
    id: p.id,
    procedure: "query",
    operationId: "two-step",
    arguments: { query: "first" },
  };
  await assert.rejects(
    runtime.call("packRun", {
      ...request,
      arguments: { query: "first", extra: "bad" },
    }),
    /arguments-mismatch/,
  );
  const run = runtime.call("packRun", request);
  for (const [before, expected] of [
    ["", "first"],
    ["first", "second"],
  ]) {
    let c = await pending(runtime);
    const o = observation({ session });
    o.nodes[0].value = before;
    runtime.reply(session, c.id, o);
    c = await pending(runtime);
    assert.equal(c.kind, "act");
    assert.equal(c.args.action.text, expected);
    assert.equal(c.args.action.expectedValue, before);
    runtime.reply(session, c.id, {
      accepted: true,
      delivery: "synthetic-dispatched",
      outcome: "unknown",
      reason: "fixture",
    });
  }
  const c = await pending(runtime),
    o = observation({ session });
  o.nodes[0].value = "second";
  runtime.reply(session, c.id, o);
  const result = await run;
  assert.equal(result.steps.length, 2);
  assert.equal(result.outcome, "observed");
  assert.equal(store.data.operations["two-step"].revision, draft.revision);
  assert.equal(store.data.operations["two-step"].effectiveRevision.length, 64);
  const edit = await runtime.packs.draft(
    { ...p, version: "0.2.0" },
    draft.revision,
  );
  await store.change((s) => {
    s.packs[p.id].active = edit.revision;
  });
  assert.deepEqual(await runtime.call("packRun", request), result);
  await assert.rejects(
    runtime.call("packRun", { ...request, arguments: { query: "changed" } }),
    /operation-id-conflict/,
  );
});
test("inherited selectors and references resolve pinned base without widening scope/permissions", async (t) => {
  const { runtime, session, store } = await fixture(t),
    base = pack(),
    r = await runtime.packs.draft(base, null);
  const overlay = pack({
    id: "overlay",
    extends: { id: base.id, revision: r.revision },
    roles: [{ id: "extra", locator: { selector: "#extra" }, extract: "text" }],
  });
  const own = await runtime.packs.draft(overlay, null);
  assert.equal(
    runtime.packs.effective(overlay.id, own.revision).roles.length,
    2,
  );
  const updated = await runtime.packs.draft(
    {
      ...base,
      version: "0.2.0",
      roles: [{ ...base.roles[0], locator: { selector: "#changed" } }],
    },
    r.revision,
  );
  await store.change((s) => {
    s.packs[base.id].active = updated.revision;
    s.packs[overlay.id].active = own.revision;
  });
  const result = runtime.call("observe", {}),
    c = await pending(runtime);
  assert.ok(c.args.selectors.includes("#search"));
  assert.ok(c.args.selectors.includes("#extra"));
  runtime.reply(session, c.id, observation({ session }));
  await result;
  await assert.rejects(
    runtime.packs.draft(
      { ...overlay, id: "wider", permissions: ["read", "fill", "click"] },
      null,
    ),
    /permission-widening/,
  );
  await assert.rejects(
    runtime.packs.draft(
      {
        ...overlay,
        id: "other-origin",
        scope: { ...overlay.scope, origin: "https://other.example" },
      },
      null,
    ),
    /scope-widening/,
  );
  const missing = {
    ...overlay,
    id: "missing",
    procedures: [
      {
        ...overlay.procedures[0],
        steps: [{ kind: "fill", role: "not-inherited", text: "bad" }],
      },
    ],
  };
  await assert.rejects(runtime.packs.draft(missing, null));
});
test("parent cancellation after child lease returns unknown and emits no later step; cancellation records are bounded by running work", async (t) => {
  const { runtime, store, session } = await fixture(t, 500),
    p = pack();
  p.procedures[0].steps.push({ kind: "fill", role: "search", text: "later" });
  const r = await runtime.packs.draft(p, null);
  await store.change((s) => {
    s.packs[p.id].active = r.revision;
  });
  const run = runtime.call("packRun", {
    id: p.id,
    procedure: "query",
    operationId: "cancel-parent",
  });
  let c = await pending(runtime);
  runtime.reply(session, c.id, observation({ session }));
  c = await pending(runtime);
  assert.equal(c.kind, "act");
  const cancel = await runtime.call("cancel", { operationId: "cancel-parent" });
  assert.equal(cancel.cancelRequested, true);
  assert.equal((await run).delivery, "unknown");
  assert.equal(runtime.pending, null);
  assert.equal(runtime.cancelled.size, 0);
  assert.equal(runtime.children.size, 0);
  assert.throws(() => runtime.reply(session, c.id, {}), /unowned/);
  for (let i = 0; i < 100; i++)
    await runtime.call("cancel", { operationId: "absent-" + i });
  assert.equal(runtime.cancelled.size, 0);
});
test("parent ledger has the same bound as primitives", async (t) => {
  const { runtime, store } = await fixture(t),
    p = pack(),
    r = await runtime.packs.draft(p, null);
  await store.change((s) => {
    s.packs[p.id].active = r.revision;
    for (let i = 0; i < 10000; i++)
      s.operations["old-" + i] = {
        digest: "x",
        receipt: {
          accepted: true,
          delivery: "not-sent",
          outcome: "unknown",
          reason: "fixture",
        },
      };
  });
  await assert.rejects(
    runtime.call("packRun", {
      id: p.id,
      procedure: "query",
      operationId: "full",
    }),
    /ledger-full/,
  );
  assert.equal(runtime.pending, null);
});
test("external edit during mutation callback is detected before replace, preserves disk and in-memory drafts and removes temp", async (t) => {
  const { store, root } = await fixture(t);
  await store.change((s) => {
    s.marker = "original";
  });
  await assert.rejects(
    store.change(async (s) => {
      s.marker = "draft";
      await writeFile(
        store.file,
        JSON.stringify({ ...store.data, marker: "external" }),
      );
    }),
    /externally-edited/,
  );
  assert.equal(
    JSON.parse(await readFile(store.file, "utf8")).marker,
    "external",
  );
  assert.equal(store.data.marker, "original");
  assert.equal(
    (await readdir(root)).some((n) => n.endsWith(".tmp")),
    false,
  );
});
