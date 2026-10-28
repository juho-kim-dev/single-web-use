import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as pause } from "node:timers/promises";
import { stat } from "node:fs/promises";
import { fixture, observation, pack, pending, action } from "./helpers.js";
import { assess, resolveRoles, checkConditions } from "../src/packs.js";
import { createOverlay } from "../extension/editor.js";

function repeated(session, count = 20) {
  const o = observation({ session });
  o.nodes = Array.from({ length: count }, (_, i) => ({
    ...o.nodes[0],
    ref: "node-" + i,
    tag: "a",
    href: "https://example.com/item-" + i,
    text: "Item " + i,
    matches: ["#search"],
    locator: { selector: "#item-" + i },
  }));
  o.coverage.visited = count;
  return o;
}
async function ready(runtime, session, p, o) {
  const r = await runtime.packs.draft(p, null);
  o.at = Date.now() + 1;
  const report = await runtime.packs.recordTest(p.id, r.revision, o);
  assert.equal(report.pass, true);
  await runtime.packs.activate(p.id, r.revision, session, p.permissions);
  return r;
}
test("harness waits through slow fs preparation and settles unawaited requests before deleting temp state", async (t) => {
  const { runtime, store, session, root, cleanup } = await fixture(t);
  const save = store.change.bind(store);
  store.change = async (fn) => {
    await pause(120);
    return save(fn);
  };
  const o = runtime.retain(observation({ session })),
    run = runtime.call("act", action(o)),
    c = await pending(runtime);
  assert.ok(c);
  const close = cleanup();
  const receipt = await run;
  assert.equal(receipt.delivery, "unknown");
  await close;
  await assert.rejects(stat(root), { code: "ENOENT" });
});
test("all 900 ordinary items paginate beyond offset300 on one immutable observation", async (t) => {
  const { runtime, session } = await fixture(t),
    o = runtime.retain(repeated(session, 300));
  let result = await runtime.call("read", {
      observationId: o.id,
      limit: 100,
      maxBytes: 524288,
    }),
    count = result.items.length,
    above300 = false;
  while (result.continuation) {
    above300 ||= result.continuation.args.offset > 300;
    result = await runtime.call("read", result.continuation.args);
    assert.equal(result.observationId, o.id);
    count += result.items.length;
  }
  assert.equal(count, 900);
  assert.equal(above300, true);
  assert.equal(runtime.pending, null);
});
test("read and context/draft extraction continuations pin exact revisions across update and deactivate", async (t) => {
  const { runtime, session } = await fixture(t),
    p = pack({
      roles: [
        {
          id: "search",
          locator: { selector: "#search" },
          cardinality: "many",
          limit: 30,
          extract: "link",
        },
      ],
      permissions: ["read"],
      procedures: [],
    }),
    o = repeated(session),
    r = await ready(runtime, session, p, o);
  runtime.retain(o);
  const first = await runtime.call("read", {
      observationId: o.id,
      packId: p.id,
      limit: 5,
    }),
    context = await runtime.call("packContext", { observationId: o.id });
  const update = {
      ...p,
      version: "0.2.1",
      roles: [{ ...p.roles[0], extract: "state" }],
    },
    next = await runtime.packs.draft(update, r.revision),
    fresh = repeated(session);
  fresh.at = Date.now() + 1;
  runtime.retain(fresh);
  const probe = await runtime.packs.recordTest(p.id, next.revision, fresh);
  assert.equal(
    probe.extraction[0].continuation.args.packRevision,
    next.revision,
  );
  assert.equal(
    (await runtime.call("read", probe.extraction[0].continuation.args)).items[0]
      .mode,
    "state",
  );
  await runtime.packs.activate(p.id, next.revision, session);
  await runtime.call("packDeactivate", { id: p.id, expected: next.revision });
  const second = await runtime.call("read", first.continuation.args);
  assert.equal(second.filter.packRevision, r.revision);
  assert.equal(second.items[0].mode, "link");
  assert.equal(second.items[0].value.href, o.nodes[5].href);
  assert.equal(second.inputPermission, false);
  const contextual = await runtime.call(
    "read",
    context.matches[0].extraction[0].continuation.args,
  );
  assert.equal(contextual.filter.packRevision, r.revision);
  assert.equal(contextual.items[0].mode, "link");
  await assert.rejects(
    runtime.call("read", {
      ...first.continuation.args,
      effectiveRevision: "a".repeat(64),
    }),
    /revision-mismatch/,
  );
});
test("truncated many role cannot witness any condition or authorize scope/input; discovery reports blocked", async (t) => {
  const { runtime, session, store } = await fixture(t),
    p = pack();
  p.roles[0] = { ...p.roles[0], cardinality: "many", limit: 1 };
  p.scope.conditions = [{ role: "search", state: "enabled" }];
  const o = repeated(session, 2);
  o.nodes[0].disabled = false;
  o.nodes[1].disabled = true;
  o.nodes[0].value = "";
  o.nodes[1].value = "other";
  const resolved = resolveRoles(p, o);
  assert.equal(resolved.search.totalObserved, 2);
  assert.equal(resolved.search.truncated, true);
  for (const condition of [
    { role: "search", state: "enabled" },
    { role: "search", state: "value", equals: "" },
    { role: "search", state: "text", equals: "Item 0" },
  ])
    assert.equal(checkConditions([condition], resolved)[0].result, "unknown");
  assert.equal(assess(p, o).pass, false);
  const r = await runtime.packs.draft(p, null);
  o.at = Date.now() + 1;
  const report = await runtime.packs.recordTest(p.id, r.revision, o);
  assert.equal(report.pass, false);
  await assert.rejects(
    runtime.packs.activate(p.id, r.revision, session, ["fill"]),
    /passing-test/,
  );
  // Exercise previously active data without pretending a failed locator test activated it.
  await store.change((s) => {
    s.packs[p.id].active = r.revision;
  });
  runtime.retain(o);
  await assert.rejects(
    runtime.call("read", { observationId: o.id, packId: p.id }),
    /conditions-unconfirmed/,
  );
  const capabilities = await runtime.call("capabilities", {
    observationId: o.id,
    purpose: "act",
  });
  assert.ok(
    capabilities.procedures[0].blockedReasons.includes(
      "target-search-truncated",
    ),
  );
  assert.ok(
    capabilities.procedures[0].blockedReasons.includes(
      "scope-or-initial-conditions-unconfirmed",
    ),
  );
  const run = runtime.call("packRun", {
      id: p.id,
      procedure: "query",
      operationId: "no-condition-witness",
    }),
    c = await pending(runtime);
  runtime.reply(session, c.id, { ...o, id: "fresh-condition-check" });
  assert.equal((await run).delivery, "not-sent");
  assert.equal(runtime.pending, null);
});
test("duplicate href beyond many limit1 never creates false action uniqueness", async (t) => {
  const { runtime, session } = await fixture(t),
    p = pack({
      roles: [
        {
          id: "search",
          locator: { selector: "#search" },
          cardinality: "many",
          limit: 1,
          extract: "link",
        },
      ],
      permissions: ["read", "click"],
      procedures: [
        {
          id: "open",
          parameters: ["url"],
          preconditions: [],
          postconditions: [],
          steps: [{ kind: "click", role: "search", linkParameter: "url" }],
        },
      ],
    }),
    o = repeated(session, 2);
  o.nodes[1].href = o.nodes[0].href;
  await ready(runtime, session, p, o);
  const run = runtime.call("packRun", {
      id: p.id,
      procedure: "open",
      operationId: "duplicate-clipped",
      arguments: { url: o.nodes[0].href },
    }),
    c = await pending(runtime);
  runtime.reply(session, c.id, o);
  const receipt = await run;
  assert.equal(receipt.delivery, "not-sent");
  assert.equal(receipt.reason, "target-search-truncated");
  assert.equal(receipt.steps.length, 0);
  assert.equal(runtime.pending, null);
});
test("actual overlay helper owns no inherited conditions; maximum-eight base constraints remain once", async (t) => {
  const { runtime, session } = await fixture(t),
    base = pack({ permissions: ["read"], procedures: [] });
  base.scope.conditions = Array.from({ length: 8 }, () => ({
    role: "search",
    state: "enabled",
  }));
  const r = await runtime.packs.draft(base, null);
  const overlay = createOverlay(base, r.revision, "personal-eight");
  assert.deepEqual(overlay.scope.conditions, []);
  assert.equal(base.scope.conditions.length, 8);
  const own = await runtime.packs.draft(overlay, null);
  assert.equal(
    runtime.packs.effective(overlay.id, own.revision).scope.conditions.length,
    8,
  );
  const o = observation({ session, at: Date.now() + 1 });
  assert.equal(
    (await runtime.packs.recordTest(overlay.id, own.revision, o)).pass,
    true,
  );
});
test("ambiguous repeated-role public context and draft test are summaries, bounded with pinned reading/evidence continuations", async (t) => {
  const { runtime, session, store } = await fixture(t),
    o = repeated(session, 300),
    p = pack({
      roles: Array.from({ length: 64 }, (_, i) => ({
        id: "role-" + i,
        locator: { selector: "#search" },
        extract: "text",
      })),
      permissions: ["read"],
      procedures: [],
    }),
    r = await runtime.packs.draft(p, null);
  o.at = Date.now() + 1;
  runtime.retain(o);
  const assessment = assess(
    runtime.packs.effective(p.id, r.revision),
    o,
    r.revision,
  );
  assert.ok(Buffer.byteLength(JSON.stringify(assessment)) < 65536);
  const testResult = await runtime.packs.recordTest(p.id, r.revision, o);
  assert.equal(testResult.pass, false);
  assert.ok(Buffer.byteLength(JSON.stringify(testResult)) < 65536);
  await store.change((s) => {
    s.packs[p.id].active = r.revision;
  });
  const context = await runtime.call("packContext", {
    observationId: o.id,
    maxBytes: 65536,
  });
  assert.equal(context.matches.length, 1);
  assert.ok(context.page.bytes <= 65536);
  const role = context.matches[0].roles["role-0"];
  assert.equal(role.status, "ambiguous");
  assert.equal(role.totalObserved, 300);
  assert.equal(role.refs.length, 16);
  assert.equal(role.refsTruncated, true);
  assert.equal("nodes" in role, false);
  const more = context.matches[0].extraction[0].continuation;
  assert.equal(more.args.packRevision, r.revision);
  assert.equal(
    (await runtime.call("read", more.args)).roles[0].status,
    "ambiguous",
  );
  assert.equal(context.matches[0].evidenceRead.method, "observationRead");
  const blocked = await runtime.call("packContext", {
    observationId: o.id,
    maxBytes: 1024,
  });
  assert.equal(blocked.matches.length, 0);
  assert.equal(blocked.page.blocked, "item-exceeds-byte-budget");
  assert.equal(blocked.continuation.args.offset, 0);
});
