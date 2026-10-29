import test from "node:test";
import assert from "node:assert/strict";
import { connectionGuidance } from "../extension/diagnostics.js";

test("popup shared handler shows fixed bilingual foreground guidance and retains error code", async (t) => {
  const saved = {
    document: globalThis.document,
    chrome: globalThis.chrome,
    Option: globalThis.Option,
  };
  t.after(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
  });
  const controls = new Map();
  const control = (id) => {
    if (!controls.has(id))
      controls.set(id, {
        value: "",
        listeners: new Map(),
        addEventListener(k, f) {
          this.listeners.set(k, f);
        },
      });
    return controls.get(id);
  };
  globalThis.document = { getElementById: control, querySelectorAll: () => [] };
  globalThis.Option = class {};
  globalThis.chrome = {
    windows: { getCurrent: async () => ({ id: 2 }) },
    runtime: {
      sendMessage: async (m) =>
        m.type === "status"
          ? {
              result: {
                extensionId: "test",
                connected: false,
                lastError: "bound-tab-url-unavailable",
              },
            }
          : { error: "bound-window-unfocused" },
    },
  };
  await import("../extension/popup.js?connection-diagnostics");
  assert.equal(
    control("status").textContent,
    connectionGuidance("bound-tab-url-unavailable"),
  );
  await control("bind").listeners.get("click")();
  assert.equal(
    control("status").textContent,
    connectionGuidance("bound-window-unfocused"),
  );
  for (const code of [
    "tab-not-bound",
    "connect-tab-query-failed",
    "connect-tab-not-found",
    "bound-tab-unavailable",
    "bound-tab-not-found",
    "bound-tab-missing",
    "bound-tab-query-failed",
    "bound-tab-removed",
    "bound-tab-replaced",
    "binding-cleanup-unconfirmed",
    "disconnect-session-changed",
    "bound-window-unavailable",
    "bound-tab-inactive",
    "bound-tab-window-mismatch",
    "bound-window-unfocused",
    "bound-window-minimized",
    "bound-tab-url-unavailable",
    "bound-tab-url-not-http",
    "disconnect-before-rebind",
    "binding-changed-during-connect",
  ]) {
    const guidance = connectionGuidance(code);
    assert.ok(guidance.startsWith(code + " · "));
    assert.match(guidance, /[가-힣]/);
    assert.match(guidance, /\/ [A-Z]/);
    assert.equal(guidance.includes("https://"), false);
  }
  assert.equal(connectionGuidance("runtime-paused"), "runtime-paused");
});
