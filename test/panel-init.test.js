import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "./helpers.js";
test("offline initial status cannot freeze panel polling; live toolbar errors appear and recovery clears only connection error", async (t) => {
  const saved = {
    document: globalThis.document,
    chrome: globalThis.chrome,
    Option: globalThis.Option,
    addEventListener: globalThis.addEventListener,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  };
  t.after(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
  });
  const controls = new Map(),
    events = new Map(),
    timers = new Map();
  let seq = 0,
    phase = "offline",
    polls = 0;
  const control = (id) => {
    if (!controls.has(id))
      controls.set(id, {
        value: "",
        textContent: "",
        listeners: new Map(),
        addEventListener(k, f) {
          this.listeners.set(k, f);
        },
      });
    return controls.get(id);
  };
  globalThis.document = {
    getElementById: control,
    querySelectorAll: () => [],
    visibilityState: "visible",
    addEventListener: (k, f) => events.set(k, f),
  };
  globalThis.addEventListener = (k, f) => events.set(k, f);
  globalThis.Option = class {};
  globalThis.setTimeout = (fn) => {
    timers.set(++seq, fn);
    return seq;
  };
  globalThis.clearTimeout = (id) => timers.delete(id);
  globalThis.chrome = {
    windows: { getCurrent: async () => ({ id: 7 }) },
    runtime: {
      sendMessage: async (m) => {
        if (m.type === "status") throw Error("worker-initial-unavailable");
        if (m.type === "panelStatus") {
          polls++;
          return {
            result:
              phase === "offline"
                ? { paired: true, runtimeAvailable: false }
                : {
                    paired: true,
                    runtimeAvailable: true,
                    adapterOwned: true,
                    foregroundReady: phase !== "error",
                    runtime: { connected: true, binding: { tabId: 42 } },
                    lastError: "bound-window-unfocused",
                  },
          };
        }
        throw Error("unexpected-test-message");
      },
    },
  };
  await import("../extension/popup.js?initial-failure-status");
  await waitFor(() => polls === 1 && timers.size === 1);
  assert.match(control("connectionState").textContent, /Connector/);
  assert.ok(control("read").listeners.has("click"));
  const tick = async () => {
    const [id, fn] = timers.entries().next().value;
    timers.delete(id);
    fn();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await waitFor(() => timers.size === 1);
  };
  phase = "error";
  await tick();
  assert.match(control("status").textContent, /bound-window-unfocused/);
  phase = "recovered";
  await tick();
  assert.equal(control("status").textContent, "");
  assert.match(control("connectionState").textContent, /연결됨/);
  control("status").textContent = "draft-conflict-reload-required";
  await tick();
  assert.equal(control("status").textContent, "draft-conflict-reload-required");
  events.get("pagehide")();
  assert.equal(timers.size, 0);
});
