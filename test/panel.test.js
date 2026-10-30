import test from "node:test";
import assert from "node:assert/strict";
import { createStatusPoller, describePanelStatus } from "../extension/panel.js";
test("visible panel polling never overlaps, discards hidden/stopped responses and cleans timers", async () => {
  let visible = false,
    loads = 0,
    resolve,
    renders = 0;
  const timers = new Map();
  let seq = 0;
  const poll = createStatusPoller({
    isVisible: () => visible,
    load: () => {
      loads++;
      return new Promise((r) => (resolve = r));
    },
    onStatus: () => renders++,
    onError: () => {},
    schedule: (fn) => {
      timers.set(++seq, fn);
      return seq;
    },
    cancel: (id) => timers.delete(id),
  });
  poll.start();
  assert.equal(loads, 0);
  visible = true;
  poll.start();
  await poll.refresh();
  assert.equal(loads, 1);
  visible = false;
  poll.stop();
  resolve({});
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(renders, 0);
  assert.equal(timers.size, 0);
  visible = true;
  poll.start();
  resolve({});
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(renders, 1);
  assert.equal(timers.size, 1);
  poll.stop();
  assert.equal(timers.size, 0);
});
test("panel status distinguishes setup, unavailable, target, connected, explicit disconnect, pause and fence", () => {
  const base = {
    paired: true,
    runtimeAvailable: true,
    runtime: { connected: false },
  };
  assert.equal(describePanelStatus({ paired: false }).key, "pairing-needed");
  assert.equal(
    describePanelStatus({ paired: true }).key,
    "runtime-unavailable",
  );
  assert.equal(describePanelStatus(base).key, "target-needed");
  assert.equal(
    describePanelStatus({
      ...base,
      runtime: { connected: true, binding: { tabId: 1 } },
      adapterOwned: true,
      foregroundReady: true,
    }).key,
    "connected",
  );
  assert.equal(
    describePanelStatus({ ...base, userDisconnected: true }).key,
    "disconnected",
  );
  assert.equal(
    describePanelStatus({ ...base, runtime: { paused: true } }).key,
    "paused",
  );
  assert.equal(
    describePanelStatus({ ...base, runtime: { fenced: true } }).key,
    "fenced",
  );
});

test("background-owned target remains connected without claiming foreground readiness", () => {
  const s = { paired: true, runtimeAvailable: true, adapterOwned: true,
    foregroundReady: false, lastError: "bound-window-unfocused",
    runtime: { connected: true, binding: { tabId: 1 } } };
  assert.equal(describePanelStatus(s).key, "connected-background");
  assert.equal(describePanelStatus({ ...s, adapterOwned: false }).key, "target-needed");
  assert.equal(describePanelStatus({ ...s, lastError: "bound-tab-window-mismatch" }).key, "target-needed");
  assert.equal(describePanelStatus({ ...s, runtime: { ...s.runtime, paused: true } }).key, "paused");
  assert.equal(describePanelStatus({ ...s, runtime: { ...s.runtime, fenced: true } }).key, "fenced");
});
