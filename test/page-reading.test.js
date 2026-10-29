import test from "node:test";
import assert from "node:assert/strict";
import { fixture, observation, pack, pending, waitFor } from "./helpers.js";
import { hash, StateStore } from "../src/storage.js";
import { Runtime } from "../src/runtime.js";
import { apiSchemas, packSchema } from "../src/contracts.js";
import { handle } from "../src/mcp.js";

function page(session, y = 0, overrides = {}) {
  const o = observation({ session, ...overrides });
  o.nodes[0] = {
    ...o.nodes[0],
    tag: "div",
    editable: false,
    value: null,
    text: "visible-" + y,
    scroll: {
      x: 0,
      y,
      width: 200,
      height: 2000,
      clientWidth: 200,
      clientHeight: 100,
      basis: "observed-element-DOM-metrics-not-visible-content",
    },
  };
  return o;
}
async function setup(t, overrides = {}) {
  const f = await fixture(t);
  const p = pack({ permissions: ["read", "scroll"], procedures: [] });
  const d = await f.runtime.packs.draft(p, null);
  await f.runtime.packs.recordTest(
    p.id,
    d.revision,
    page(f.session, 0, { at: Date.now() + 100 }),
  );
  await f.runtime.packs.activate(p.id, d.revision, f.session, ["scroll"]);
  const a = {
    operationId: "read-container",
    packId: p.id,
    packRevision: d.revision,
    effectiveRevision: hash(f.runtime.packs.effective(p.id, d.revision)),
    scrollRole: "search",
    read: { roles: ["search"], kinds: ["text"] },
    maxSteps: 1,
    maxElapsedMs: 10000,
    maxContentBytes: 65536,
    dy: 100,
    ...overrides,
  };
  return { ...f, a };
}
async function replyCapture(f, o = page(f.session)) {
  const c = await pending(f.runtime);
  assert.equal(c.kind, "observe");
  f.runtime.reply(f.session, c.id, o);
  return c;
}
async function replyScroll(f, delivery = "synthetic-dispatched") {
  const c = await pending(f.runtime);
  assert.equal(c.kind, "act");
  f.runtime.reply(f.session, c.id, {
    accepted: true,
    delivery,
    outcome: "unknown",
    reason: "fixture",
  });
  return c;
}
test("pageRead accepts multiple viewports, reports measured progress and pinned filtered routes without saving raw content", async (t) => {
  const f = await setup(t),
    run = f.runtime.call("pageRead", f.a);
  await replyCapture(f);
  await replyScroll(f);
  await replyCapture(f, page(f.session, 100));
  const r = await run;
  assert.equal(r.captures.length, 2);
  assert.equal(r.steps.length, 1);
  assert.equal(r.captures[1].progress.deltaY, 100);
  const diff = await f.runtime.call("observationDiff", {
    before: r.captures[0].observationId,
    after: r.captures[1].observationId,
  });
  assert.ok(diff.changed[0].fields.includes("scroll"));
  assert.equal(r.captures[1].progress.contentChanged, true);
  assert.equal(r.reason, "page-read-step-budget");
  assert.equal(r.wholePageRead, "not-established");
  const reading = await f.runtime.call("read", r.captures[1].reading.args);
  assert.equal(reading.items[0].value.text, "visible-100");
  assert.equal(reading.inputPermission, false);
  assert.equal(
    JSON.stringify(f.store.data.operations).includes("visible-100"),
    false,
  );
  assert.equal(Object.keys(f.store.data.contents).length, 0);
  assert.deepEqual(await f.runtime.call("pageRead", f.a), r);
  await assert.rejects(
    f.runtime.call("pageRead", { ...f.a, dy: 101 }),
    /operation-id-conflict/,
  );
  const s = new StateStore(f.root);
  await s.init();
  const restarted = new Runtime(s);
  assert.deepEqual(await restarted.call("pageRead", f.a), r);
  assert.equal(restarted.pending, null);
});
test("pageRead rejects incompatible URL/document/generation/viewport/user/role identity without mixing captures", async (t) => {
  for (const change of [
    { url: "https://example.com/other" },
    { documentId: "other" },
    { generation: 1 },
    { viewport: { width: 801, height: 600, x: 0, y: 0, scale: 1, dpr: 1 } },
    { userEpoch: 1 },
  ]) {
    const f = await setup(t),
      run = f.runtime.call("pageRead", f.a);
    await replyCapture(f);
    await replyScroll(f);
    await replyCapture(f, page(f.session, 100, change));
    const r = await run;
    assert.equal(r.captures.length, 1);
    assert.equal(r.reason, "page-read-context-changed");
    assert.equal(r.steps.length, 1);
  }
});
test("pageRead refuses ambiguous/truncated/unknown samples and never scrolls first candidate", async (t) => {
  for (const mode of ["ambiguous", "truncated", "unknown"]) {
    const f = await setup(t),
      o = page(f.session);
    if (mode === "ambiguous") o.nodes.push({ ...o.nodes[0], ref: "n2" });
    if (mode === "truncated") o.coverage.truncated = true;
    if (mode === "unknown") delete o.nodes[0].scroll;
    const run = f.runtime.call("pageRead", f.a);
    await replyCapture(f, o);
    const r = await run;
    assert.equal(r.steps.length, 0);
    assert.equal(r.captures.length, 0);
    assert.match(r.reason, /unresolved|unconfirmed/);
  }
});
test("pageRead no movement is a stop, never end; zero steps and content budgets are strict", async (t) => {
  const f = await setup(t),
    run = f.runtime.call("pageRead", f.a);
  await replyCapture(f);
  await replyScroll(f);
  await replyCapture(f);
  const r = await run;
  assert.equal(r.captures.length, 2);
  assert.equal(r.reason, "page-read-no-downward-movement-not-end");
  for (const overrides of [{ maxSteps: 0 }, { maxContentBytes: 1024 }]) {
    const f = await setup(t, overrides),
      run = f.runtime.call("pageRead", f.a);
    await replyCapture(f);
    const r = await run;
    assert.equal(r.steps.length, 0);
    assert.ok(r.contentBytes <= f.a.maxContentBytes);
    assert.match(r.reason, /budget/);
  }
});
test("pageRead unknown input fences, cancels capture and stops on rebind/pause without later commands", async (t) => {
  for (const mode of ["unknown", "cancel", "pause", "rebind"]) {
    const f = await setup(t),
      run = f.runtime.call("pageRead", f.a);
    if (mode === "unknown") {
      await replyCapture(f);
      await replyScroll(f, "unknown");
    } else {
      await pending(f.runtime);
      if (mode === "cancel")
        await f.runtime.call("cancel", { operationId: f.a.operationId });
      if (mode === "pause") await f.runtime.call("pause", { paused: true });
      if (mode === "rebind") f.runtime.bind({ tabId: 2, windowId: 2 });
    }
    const r = await run;
    assert.equal(f.runtime.pending, null);
    if (mode === "unknown") {
      assert.equal(r.delivery, "unknown");
      assert.equal(f.runtime.fenced, true);
    } else assert.equal(r.steps.length, 0);
  }
});
test("pageRead lease cancellation keeps unknown delivery, unleased cancellation is not sent", async (t) => {
  for (const leased of [false, true]) {
    const f = await setup(t),
      run = f.runtime.call("pageRead", f.a);
    await replyCapture(f);
    await waitFor(() => f.runtime.pending?.command.kind === "act");
    if (leased) await pending(f.runtime);
    await f.runtime.call("cancel", { operationId: f.a.operationId });
    const r = await run;
    assert.equal(r.delivery, leased ? "unknown" : "not-sent");
    assert.equal(r.captures.length, 1);
  }
});
test("pageRead pause during child reservation prevents dispatch even after resume", async (t) => {
  const f = await setup(t);
  let entered, release;
  const gate = new Promise((r) => (release = r)),
    ready = new Promise((r) => (entered = r)),
    reserve = f.runtime.reserve.bind(f.runtime);
  f.runtime.reserve = async (id, ...rest) => {
    await reserve(id, ...rest);
    if (id !== f.a.operationId) {
      entered();
      await gate;
    }
  };
  const run = f.runtime.call("pageRead", f.a);
  await replyCapture(f);
  await ready;
  await f.runtime.call("pause", { paused: true });
  await f.runtime.call("pause", { paused: false });
  release();
  const r = await run;
  assert.equal(r.delivery, "not-sent");
  assert.equal(f.runtime.pending, null);
});
test("pageRead time budget caps capture deadline and never retries on timeout", async (t) => {
  const f = await setup(t, { maxElapsedMs: 100 });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const run = f.runtime.call("pageRead", f.a),
    cmd = await pending(f.runtime);
  assert.ok(cmd.deadline - Date.now() <= 100);
  t.mock.timers.tick(100);
  const r = await run;
  assert.equal(r.steps.length, 0);
  assert.match(r.reason, /timeout|time-budget/);
  assert.equal(f.runtime.pending, null);
});
test("pageRead strict active/effective pinning and current-pack updates preserve original capture route", async (t) => {
  const f = await setup(t, { maxSteps: 0 });
  await assert.rejects(
    f.runtime.call("pageRead", { ...f.a, effectiveRevision: "0".repeat(64) }),
    /effective-revision/,
  );
  assert.equal(
    apiSchemas.pageRead.safeParse({
      ...f.a,
      read: { ...f.a.read, within: "n1" },
    }).success,
    false,
  );
  const run = f.runtime.call("pageRead", f.a);
  await replyCapture(f);
  const r = await run;
  await f.runtime.packs.deactivate(f.a.packId, f.a.packRevision);
  assert.equal(
    (await f.runtime.call("read", r.captures[0].reading.args)).items.length,
    1,
  );
  await assert.rejects(
    f.runtime.call("pageRead", { ...f.a, operationId: "new-run" }),
    /active-revision/,
  );
  const tools = await handle({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const tool = tools.result.tools.find((t) => t.name === "pageRead");
  assert.equal(tool.annotations.readOnlyHint, false);
  assert.ok(
    (
      await f.runtime.call("capabilities", { purpose: "act" })
    ).commands.includes("pageRead"),
  );
  assert.equal(packSchema.parse(pack()).procedures[0].arrival, undefined);
});

test("pageRead parent reservation cancellation, concurrent progress and restarted pending receipt never replay", async (t) => {
  const f = await setup(t);
  let entered, release;
  const ready = new Promise((r) => (entered = r)),
    gate = new Promise((r) => (release = r)),
    reserve = f.runtime.reserve.bind(f.runtime);
  f.runtime.reserve = async (...args) => {
    await reserve(...args);
    entered();
    await gate;
  };
  const run = f.runtime.call("pageRead", f.a);
  await ready;
  await f.runtime.call("cancel", { operationId: f.a.operationId });
  release();
  assert.equal((await run).steps.length, 0);
  assert.equal(f.runtime.pending, null);
  const next = await setup(t),
    running = next.runtime.call("pageRead", next.a);
  await replyCapture(next);
  const command = await pending(next.runtime);
  const progress = await next.runtime.call("operation", {
    operationId: next.a.operationId,
  });
  assert.equal(progress.captures.length, 1);
  assert.equal(progress.delivery, "pending");
  // The persisted pending journal is separate from the mutable in-memory progress report.
  assert.equal(
    next.store.data.operations[next.a.operationId].receipt.captures.length,
    0,
  );
  const restored = new StateStore(next.root);
  await restored.init();
  const other = new Runtime(restored);
  const retry = await other.call("pageRead", next.a);
  assert.equal(retry.delivery, "unknown");
  assert.equal(other.pending, null);
  next.runtime.reply(next.session, command.id, {
    accepted: true,
    delivery: "not-sent",
    outcome: "unknown",
    reason: "fixture",
  });
  await running;
});

test("pageRead preserves pack revision across a changed active definition and rejects wrong session capture", async (t) => {
  const f = await setup(t),
    run = f.runtime.call("pageRead", f.a);
  await replyCapture(f);
  await replyScroll(f);
  const p = pack({
    version: "0.2.0",
    permissions: ["read", "scroll"],
    procedures: [],
  });
  const d = await f.runtime.packs.draft(p, f.a.packRevision);
  await f.runtime.packs.recordTest(
    p.id,
    d.revision,
    page(f.session, 100, { at: Date.now() + 100 }),
  );
  await f.runtime.packs.activate(p.id, d.revision, f.session, ["scroll"]);
  await replyCapture(f, page(f.session, 100));
  const r = await run;
  assert.equal(r.captures.length, 2);
  assert.equal(r.captures[1].reading.args.packRevision, f.a.packRevision);
  assert.equal(
    (await f.runtime.call("read", r.captures[1].reading.args)).filter
      .packRevision,
    f.a.packRevision,
  );
  const other = await setup(t),
    task = other.runtime.call("pageRead", other.a);
  await replyCapture(other, page("other-session"));
  assert.equal((await task).captures.length, 0);
});

test("pageRead pauses after a capture reply and never uses that historical result for input", async (t) => {
  const f = await setup(t),
    run = f.runtime.call("pageRead", f.a),
    cmd = await pending(f.runtime),
    o = page(f.session);
  f.runtime.reply(f.session, cmd.id, o);
  const pause = f.runtime.call("pause", { paused: true });
  const r = await run;
  await pause;
  await f.runtime.call("pause", { paused: false });
  assert.equal(r.captures.length, 0);
  assert.equal(r.steps.length, 0);
  assert.throws(() => f.runtime.observed(o.id), /invalidated/);
});

test("pageRead pause during leased scroll keeps unknown fence across resume", async (t) => {
  const f = await setup(t),
    run = f.runtime.call("pageRead", f.a);
  await replyCapture(f);
  await pending(f.runtime);
  await f.runtime.call("pause", { paused: true });
  const r = await run;
  await f.runtime.call("pause", { paused: false });
  assert.equal(r.delivery, "unknown");
  assert.equal(f.runtime.fenced, true);
  assert.equal(f.runtime.pending, null);
  assert.equal(r.captures.length, 1);
});

test("pageRead final journal failure preserves pending parent for unknown recovery and fences delivered input", async (t) => {
  const f = await setup(t),
    run = f.runtime.call("pageRead", f.a);
  await replyCapture(f);
  await replyScroll(f);
  const cmd = await pending(f.runtime),
    change = f.store.change.bind(f.store);
  f.store.change = async () => {
    throw Error("injected-final-journal-failure");
  };
  f.runtime.reply(f.session, cmd.id, page(f.session, 100));
  await assert.rejects(run, /receipt-persistence-failed-no-retry/);
  assert.equal(f.runtime.fenced, true);
  assert.equal(f.runtime.readingProgress.size, 0);
  assert.equal(
    f.store.data.operations[f.a.operationId].receipt.delivery,
    "pending",
  );
  f.store.change = change;
  const s = new StateStore(f.root);
  await s.init();
  assert.equal(s.data.operations[f.a.operationId].receipt.delivery, "unknown");
});
