import test from "node:test";
import assert from "node:assert/strict";
import { pack, observation, fixture, pending } from "./helpers.js";
import { assess } from "../src/packs.js";
test("draft requires fresh test; activation binds exact revision/session and edits cannot reuse old test", async (t) => {
  const { runtime, session } = await fixture(t),
    p = pack(),
    r = await runtime.call("packDraft", { pack: p, expected: null });
  await assert.rejects(
    runtime.call("packActivate", { id: p.id, revision: r.revision }),
    /passing-test/,
  );
  const stale = observation({ session, at: 1 });
  await assert.rejects(
    runtime.packs.recordTest(p.id, r.revision, stale),
    /new-observation/,
  );
  const testResult = runtime.call("packTest", {
      id: p.id,
      revision: r.revision,
    }),
    c = await pending(runtime);
  runtime.reply(session, c.id, observation({ session, at: Date.now() + 1 }));
  assert.equal((await testResult).pass, true);
  assert.equal(
    (
      await runtime.call("packActivate", {
        id: p.id,
        revision: r.revision,
        acknowledgePermissions: ["fill"],
      })
    ).active,
    r.revision,
  );
  const edit = await runtime.call("packDraft", {
    pack: pack({ version: "0.1.1" }),
    expected: r.revision,
  });
  await assert.rejects(
    runtime.call("packActivate", { id: p.id, revision: edit.revision }),
    /passing-test/,
  );
  await assert.rejects(
    runtime.call("packDraft", { pack: p, expected: r.revision }),
    /draft-conflict/,
  );
  assert.equal(runtime.packs.get(p.id).active, r.revision);
});
test("missing and ambiguous roles stay unknown; conditional scope mismatch is not success", () => {
  const p = pack(),
    o = observation();
  assert.equal(assess(p, o).pass, true);
  o.nodes = [];
  assert.equal(assess(p, o).roles.search.status, "not-observed");
  const both = observation();
  both.nodes.push({ ...both.nodes[0], ref: "n2" });
  assert.equal(assess(p, both).roles.search.status, "ambiguous");
  p.scope.conditions = [
    { role: "search", state: "value", equals: "different" },
  ];
  assert.equal(assess(p, observation()).pass, false);
});
test("installed base, personal overlay and incoming update stay separate and export excludes evidence", async (t) => {
  const { runtime } = await fixture(t),
    base = await runtime.call("packImport", { pack: pack(), expected: null });
  const personal = pack({
    id: "personal",
    extends: { id: "search", revision: base.revision },
    version: "0.2.0",
    roles: [
      { id: "search", locator: { selector: "#personal" }, extract: "text" },
    ],
  });
  const overlay = await runtime.call("packDraft", {
    pack: personal,
    expected: null,
  });
  const incoming = pack({
    version: "0.2.0",
    roles: [{ id: "search", locator: { selector: "#new" }, extract: "text" }],
  });
  const preview = await runtime.call("packUpdatePreview", {
    id: "search",
    pack: incoming,
  });
  assert.equal(preview.automaticMerge, false);
  assert.deepEqual(preview.overlays, ["personal"]);
  assert.equal(
    runtime.packs.effective("personal", overlay.revision).roles[0].locator
      .selector,
    "#personal",
  );
  const exported = await runtime.call("packExport", {
    id: "personal",
    revision: overlay.revision,
  });
  assert.equal(exported.extends.revision, base.revision);
  assert.equal("tests" in exported, false);
  assert.equal(runtime.packs.get("search").draft, base.revision);
});
test("complete pack procedure rechecks current roles, emits one guarded input, then checks postcondition", async (t) => {
  const { runtime, session } = await fixture(t, 300),
    p = pack(),
    draft = await runtime.packs.draft(p, null);
  await runtime.packs.recordTest(
    p.id,
    draft.revision,
    observation({ session, at: Date.now() + 1 }),
  );
  await runtime.packs.activate(p.id, draft.revision, session, ["fill"]);
  const run = runtime.call("packRun", {
    id: p.id,
    procedure: "query",
    operationId: "procedure-1",
  });
  let c = await pending(runtime);
  assert.equal(c.kind, "observe");
  runtime.reply(session, c.id, observation({ session }));
  c = await pending(runtime);
  assert.equal(c.kind, "act");
  runtime.reply(session, c.id, {
    accepted: true,
    delivery: "synthetic-dispatched",
    outcome: "unknown",
    reason: "fixture",
  });
  c = await pending(runtime);
  const after = observation({ session });
  after.nodes[0].value = "SWU";
  runtime.reply(session, c.id, after);
  const receipt = await run;
  assert.equal(receipt.outcome, "observed");
  assert.equal(receipt.steps.length, 1);
  assert.deepEqual(
    await runtime.call("packRun", {
      id: p.id,
      procedure: "query",
      operationId: "procedure-1",
    }),
    receipt,
  );
});
