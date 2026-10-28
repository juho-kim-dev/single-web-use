import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { StateStore } from "../src/storage.js";
import { observation, fixture, pending, action, tick } from "./helpers.js";
test("immutable observations, lease once, durable duplicate receipt and conflicting operation rejection", async (t) => {
  const { runtime, store, session, root } = await fixture(t);
  const o = runtime.retain(observation({ session }));
  o.nodes[0].label = "tampered";
  assert.equal(runtime.observed(o.id).nodes[0].label, "Search");
  const a = action(o),
    result = runtime.call("act", a),
    cmd = await pending(runtime);
  assert.equal(runtime.poll(session).command, null);
  runtime.reply(session, cmd.id, {
    accepted: true,
    delivery: "synthetic-dispatched",
    outcome: "unknown",
    reason: "fixture",
  });
  assert.equal((await result).delivery, "synthetic-dispatched");
  assert.equal((await runtime.call("act", a)).delivery, "synthetic-dispatched");
  assert.equal(runtime.pending, null);
  await assert.rejects(
    runtime.call("act", { ...a, text: "other" }),
    /operation-id-conflict/,
  );
  const reopened = new StateStore(root);
  await reopened.init();
  assert.deepEqual(reopened.data.operations, store.data.operations);
});
test("cancel before lease prevents input; late cancellation fences and timeout never retries", async (t) => {
  const { runtime, session } = await fixture(t, 30),
    o = runtime.retain(observation({ session })),
    a = action(o);
  const result = runtime.call("act", a);
  for (let i = 0; i < 30 && !runtime.pending; i++) await tick();
  await runtime.call("cancel", { operationId: a.operationId });
  assert.equal((await result).delivery, "not-sent");
  const other = { ...a, operationId: "unknown-operation" },
    unknown = runtime.call("act", other);
  await pending(runtime);
  assert.equal((await unknown).delivery, "unknown");
  assert.equal(runtime.fenced, true);
  assert.equal((await runtime.call("act", other)).delivery, "unknown");
  assert.equal(runtime.pending, null);
  await assert.rejects(
    runtime.call("act", { ...a, operationId: "blocked-operation" }),
    /surface-fenced/,
  );
});
test("rebind invalidates old observations, rejects old bridge replies and preserves unknown operation on restart", async (t) => {
  const { runtime, store, session, root } = await fixture(t),
    o = runtime.retain(observation({ session }));
  const result = runtime.call("act", action(o)),
    cmd = await pending(runtime);
  runtime.bind({ tabId: 1, windowId: 2 });
  assert.equal((await result).delivery, "unknown");
  assert.throws(() => runtime.observed(o.id), /expired/);
  assert.throws(() => runtime.reply(session, cmd.id, {}), /unowned/);
  await store.change((s) => {
    s.operations.pending = {
      digest: "x",
      receipt: {
        accepted: true,
        delivery: "pending",
        outcome: "unknown",
        reason: "interrupted",
      },
    };
  });
  const restored = new StateStore(root);
  await restored.init();
  assert.equal(restored.data.operations.pending.receipt.delivery, "unknown");
});
test("external edits are preserved and rejected, rather than silently overwritten", async (t) => {
  const { store } = await fixture(t);
  await store.change((s) => {
    s.marker = "original";
  });
  const external = JSON.parse(await readFile(store.file, "utf8"));
  external.marker = "edited";
  await writeFile(store.file, JSON.stringify(external));
  await assert.rejects(
    store.change((s) => {
      s.marker = "clobber";
    }),
    /externally-edited/,
  );
  assert.equal(JSON.parse(await readFile(store.file, "utf8")).marker, "edited");
});
test("two CLI clients serialize same-surface observations and retain independent evidence", async (t) => {
  const { runtime, session } = await fixture(t),
    one = runtime.call("observe", {}),
    two = runtime.call("observe", {});
  const c1 = await pending(runtime);
  runtime.reply(session, c1.id, observation({ session }));
  await one;
  const c2 = await pending(runtime);
  assert.notEqual(c1.id, c2.id);
  runtime.reply(session, c2.id, observation({ session }));
  await two;
  assert.equal(runtime.observations.size, 2);
});
