import test from "node:test";
import assert from "node:assert/strict";
import { observation, tick } from "./helpers.js";

test("worker captures session/binding across awaits; disconnect before injection produces no script execution", async () => {
  const saved = { chrome: globalThis.chrome, fetch: globalThis.fetch };
  let listener,
    tabCalls = 0,
    release,
    started,
    scriptCalls = 0,
    reply;
  const gate = new Promise((r) => (release = r)),
    start = new Promise((r) => (started = r)),
    session = "session-fixture";
  const event = { addListener() {} };
  globalThis.chrome = {
    storage: {
      local: { get: async () => ({ token: "a".repeat(64) }) },
      session: { get: async () => ({}), set: async () => {} },
    },
    runtime: {
      id: "b".repeat(32),
      getURL: (p) => "chrome-extension://" + "b".repeat(32) + "/" + p,
      onMessage: { addListener: (f) => (listener = f) },
    },
    tabs: {
      query: async () => [{ id: 1, windowId: 2 }],
      get: async () => {
        if (++tabCalls === 2) {
          started();
          await gate;
        }
        return { active: true, windowId: 2, url: "https://example.com/" };
      },
      onActivated: event,
      onRemoved: event,
      onUpdated: event,
    },
    windows: {
      get: async () => ({ focused: true, state: "normal" }),
      onFocusChanged: event,
    },
    scripting: {
      executeScript: async () => {
        scriptCalls++;
        return [];
      },
    },
  };
  globalThis.fetch = async (url, options) => {
    const route = new URL(url).pathname;
    const result =
      route === "/bridge/bind"
        ? { session }
        : route === "/bridge/poll"
          ? {
              command: {
                id: "command",
                session,
                kind: "act",
                args: { before: observation(), action: { operationId: "op" } },
                deadline: Date.now() + 10000,
              },
            }
          : route === "/bridge/reply"
            ? ((reply = JSON.parse(options.body)), {})
            : {};
    return { json: async () => ({ result }) };
  };
  try {
    await import("../extension/worker.js?race-test");
    const send = (message) =>
      new Promise((resolve) =>
        listener(
          message,
          { id: chrome.runtime.id, url: chrome.runtime.getURL("popup.html") },
          resolve,
        ),
      );
    assert.equal((await send({ type: "bind" })).result.connected, true);
    await start;
    await send({ type: "disconnect" });
    release();
    for (let i = 0; i < 30 && !reply; i++) await tick();
    assert.equal(scriptCalls, 0);
    assert.equal(reply.result.delivery, "unknown");
    await new Promise((r) => setTimeout(r, 270));
  } finally {
    globalThis.chrome = saved.chrome;
    globalThis.fetch = saved.fetch;
  }
});
