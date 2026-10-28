import test from "node:test";
import assert from "node:assert/strict";
import { fixture, observation, pack, pending, waitFor } from "./helpers.js";
import { StateStore } from "../src/storage.js";
import { Runtime } from "../src/runtime.js";

const action = (o, operationId) => ({
  operationId,
  observationId: o.id,
  target: "n1",
  kind: "fill",
  text: "SWU",
  expectedValue: "",
  intent: "edit-field",
});

test("resolved observation and action-after replies cannot cross a pause epoch into input authority", async (t) => {
  for (const kind of ["observe", "act"]) {
    const { runtime, session } = await fixture(t);
    const before = runtime.retain(observation({ session }));
    const task =
      kind === "observe"
        ? runtime.call("observe", {})
        : runtime.call("act", action(before, "replied-action"));
    const command = await pending(runtime);
    const after = observation({ session });
    runtime.reply(
      session,
      command.id,
      kind === "observe"
        ? after
        : {
            accepted: true,
            delivery: "synthetic-dispatched",
            outcome: "unknown",
            reason: "dispatched",
            after,
          },
    );
    const pause = runtime.call("pause", { paused: true });
    await task;
    await pause;
    await runtime.call("pause", { paused: false });
    assert.equal(runtime.retained(after.id).id, after.id);
    await assert.rejects(
      runtime.call("act", action(after, "stale-after-reply")),
      /invalidated-by-pause/,
    );
    assert.equal(runtime.pending, null);
  }
});

test("pause persists, keeps historical reading, invalidates old input refs and survives bind/restart", async (t) => {
  const { runtime, store, root, session } = await fixture(t);
  const o = runtime.retain(observation({ session }));
  const result = await runtime.call("pause", { paused: true });
  assert.equal(result.paused, true);
  assert.equal(store.data.paused, true);
  await assert.rejects(runtime.call("observe", {}), /pause/);
  assert.equal(
    (await runtime.call("observationRead", { observationId: o.id })).observation
      .id,
    o.id,
  );
  runtime.bind({ tabId: 1, windowId: 2 });
  assert.equal(runtime.paused, true);
  const reopened = new StateStore(root);
  await reopened.init();
  const restarted = new Runtime(reopened);
  assert.equal((await restarted.call("status", {})).paused, true);
  await runtime.call("pause", { paused: false });
  runtime.session = session;
  await assert.rejects(
    runtime.call("act", action(o, "old-input")),
    /invalidated-by-pause/,
  );
  assert.equal(store.data.operations["old-input"], undefined);
});

test("pause resolves unleased input as not-sent, leased input as unknown and resume retains fence", async (t) => {
  for (const leased of [false, true]) {
    const { runtime, store, session } = await fixture(t);
    const o = runtime.retain(observation({ session }));
    const result = runtime.call("act", action(o, "pending-input"));
    await waitFor(() => runtime.pending);
    if (leased) await pending(runtime);
    await runtime.call("pause", { paused: true });
    const receipt = await result;
    assert.equal(receipt.delivery, leased ? "unknown" : "not-sent");
    assert.equal(runtime.pending, null);
    assert.equal(
      store.data.operations["pending-input"].receipt.delivery,
      receipt.delivery,
    );
    await runtime.call("pause", { paused: false });
    assert.equal(runtime.fenced, leased);
  }
});

test("pause and fast resume invalidate queued input even if the runtime is resumed before execution", async (t) => {
  const { runtime, store, session } = await fixture(t);
  const o = runtime.retain(observation({ session }));
  let release;
  const blocker = runtime.serial(
    () =>
      new Promise((r) => {
        release = r;
      }),
  );
  await waitFor(() => release);
  const queued = runtime.call("act", action(o, "queued-input"));
  const rejected = assert.rejects(queued, /invalidated-by-pause/);
  await runtime.call("pause", { paused: true });
  const duringPause = runtime.call("observe", {});
  const rejectedRead = assert.rejects(duringPause, /invalidated-by-pause/);
  await runtime.call("pause", { paused: false });
  release();
  await blocker;
  await rejected;
  await rejectedRead;
  assert.equal(runtime.pending, null);
  assert.equal(store.data.operations["queued-input"], undefined);
});

test("pause interrupts reads and persistence failure keeps the in-memory pause fail-closed", async (t) => {
  const { runtime, store, session } = await fixture(t);
  runtime.retain(observation({ session }));
  const reading = runtime.call("observe", {});
  const rejected = assert.rejects(reading, /runtime-paused/);
  await pending(runtime);
  const change = store.change.bind(store);
  store.change = async () => {
    throw Error("disk-unavailable");
  };
  await assert.rejects(
    runtime.call("pause", { paused: true }),
    /disk-unavailable/,
  );
  await rejected;
  assert.equal(runtime.paused, true);
  assert.equal(runtime.pending, null);
  store.change = change;
  await runtime.call("pause", { paused: true });
  assert.equal(store.data.paused, true);
});

test("archive preserves revisions and pinned overlays; unarchive and revision restore require fresh test", async (t) => {
  const { runtime, store, root, session } = await fixture(t);
  const p = pack({ permissions: ["read"], procedures: [] });
  const first = await runtime.packs.draft(p, null);
  const initial = observation({ session, at: Date.now() + 100 });
  await runtime.packs.recordTest(p.id, first.revision, initial);
  await runtime.packs.activate(p.id, first.revision, session);
  const overlay = pack({
    id: "personal",
    permissions: ["read"],
    procedures: [],
    roles: [{ id: "extra", locator: { selector: "#extra" }, extract: "text" }],
    extends: { id: p.id, revision: first.revision },
  });
  await runtime.packs.draft(overlay, null);
  const original = runtime.packs.exportDefinition(p.id, first.revision);
  await assert.rejects(
    runtime.call("packArchive", {
      id: p.id,
      expected: first.revision,
      expectedActive: null,
    }),
    /conflict/,
  );
  await runtime.call("packArchive", {
    id: p.id,
    expected: first.revision,
    expectedActive: first.revision,
  });
  assert.equal(
    (await runtime.call("packs", {})).find((x) => x.id === p.id).archived,
    true,
  );
  assert.deepEqual(
    runtime.packs.exportDefinition(p.id, first.revision),
    original,
  );
  assert.equal(runtime.packs.compose(overlay).roles[0].id, "search");
  await assert.rejects(runtime.packs.draft(p, first.revision), /archived/);
  await assert.rejects(
    runtime.packs.activate(p.id, first.revision, session),
    /archived/,
  );
  const reopened = new StateStore(root);
  await reopened.init();
  assert.ok(reopened.data.packs[p.id].archivedAt);
  await runtime.call("packUnarchive", { id: p.id, expected: first.revision });
  assert.equal(store.data.packs[p.id].active, null);
  await assert.rejects(
    runtime.packs.activate(p.id, first.revision, session),
    /fresh/,
  );
  const second = await runtime.packs.draft(
    { ...p, version: "0.2.0", name: "New name" },
    first.revision,
  );
  await assert.rejects(
    runtime.call("packRestore", {
      id: p.id,
      expected: first.revision,
      revision: first.revision,
    }),
    /conflict/,
  );
  await runtime.call("packRestore", {
    id: p.id,
    expected: second.revision,
    revision: first.revision,
  });
  const restored = runtime.packs.get(p.id);
  assert.equal(restored.draft, first.revision);
  assert.equal(restored.active, null);
  assert.equal(Object.keys(restored.revisions).length, 2);
  assert.deepEqual(
    runtime.packs.exportDefinition(p.id, first.revision),
    original,
  );
  await assert.rejects(
    runtime.packs.recordTest(
      p.id,
      first.revision,
      observation({ session, at: restored.restoredAt }),
    ),
    /new-observation/,
  );
  await runtime.packs.recordTest(
    p.id,
    first.revision,
    observation({ session, at: Date.now() + 100 }),
  );
  assert.equal(
    (await runtime.packs.activate(p.id, first.revision, session)).active,
    first.revision,
  );
});
