import test from "node:test";
import assert from "node:assert/strict";
import { observation } from "./helpers.js";

for (const scenario of ["late-reply", "activate", "already-ready", "activation-fails", "disconnect", "expired", "moved", "stale-action", "post-focus-loss"]) {
  test(`command activation: ${scenario}`, async () => {
    const saved = { chrome: globalThis.chrome, fetch: globalThis.fetch };
    let listener, send, activateEvent, focusEvent, dispatch = false, reply;
    let active = true, focused = true, state = "normal", windowId = 2;
    const updates = [], scripts = [], queue = [];
    const session = "activation-session", o = observation({ session });
    const noop = { addListener() {} };
    const flags = {};
    const command = (kind) => ({ id: kind, session, kind, deadline: Date.now() + 10000,
      args: kind === "observe" ? {} : { before: o, action: { operationId: "op" } } });
    globalThis.chrome = {
      storage: { local: { get: async () => ({ token: "a".repeat(64) }) },
        session: { get: async () => flags, set: async (v) => Object.assign(flags, v) } },
      runtime: { id: "test", getURL: (p) => "chrome-extension://test/" + p,
        onMessage: { addListener: (f) => listener = f } },
      tabs: { query: async () => [{ id: 1, windowId: 2 }],
        get: async () => ({ active, windowId, url: o.url }),
        update: async (id, value) => { assert.equal(id, 1); updates.push(["tab", value]); active = true; activateEvent(); },
        onActivated: { addListener: (f) => activateEvent = f }, onRemoved: noop, onUpdated: noop },
      windows: { get: async () => ({ focused, state }),
        update: async (id, value) => {
          assert.equal(id, 2); updates.push(["window", value]);
          if (scenario === "activation-fails") throw Error("private-browser-detail");
          if (value.state) state = value.state;
          if (value.focused) { focused = true; focusEvent(); }
          if (scenario === "disconnect") await send({ type: "disconnect" });
          if (scenario === "expired") queued.deadline = 0;
        }, onFocusChanged: { addListener: (f) => focusEvent = f } },
      scripting: { executeScript: async (v) => {
        scripts.push(v.args[0]);
        if (scenario === "post-focus-loss") { focused = false; focusEvent(); }
        return [{ frameId: 0, documentId: "chrome-document", result: o }];
      } },
    };
    globalThis.fetch = async (url, options) => {
      const route = new URL(url).pathname;
      let result = {};
      if (route === "/bridge/bind") result = { session };
      if (route === "/bridge/poll") result = { command: dispatch ? queue.shift() ?? null : null };
      if (route === "/bridge/reply") {
        reply = JSON.parse(options.body).result;
        if (scenario === "late-reply") return { json: async () => ({ error: "late-or-unowned-reply" }) };
      }
      if (route === "/api") result = { bindProtocol: "guarded-auto-v1", connected: true, session, binding: { tabId: 1, windowId: 2 } };
      return { json: async () => ({ result }) };
    };
    const queued = command(scenario === "stale-action" ? "act" : "observe");
    try {
      await import(`../extension/worker.js?auto-focus=${scenario}`);
      send = (message) => new Promise((r) => listener(message, { id: "test", url: "chrome-extension://test/popup.html" }, r));
      assert.equal((await send({ type: "bind", windowId: 2 })).result.connected, true);
      if (scenario === "stale-action") {
        queue.push(command("observe")); dispatch = true;
        for (let i = 0; i < 150 && !reply; i++) await new Promise((r) => setTimeout(r, 10));
        assert.equal(reply.id, o.id);
        dispatch = false; reply = undefined; scripts.length = 0;
      }
      if (scenario !== "already-ready" && scenario !== "post-focus-loss") {
        active = false; focused = false; state = "minimized";
      }
      if (scenario === "moved") windowId = 3;
      await send({ type: "panelStatus", windowId: 2 });
      await send({ type: "api", method: "contentRead", args: { id: "saved" } });
      assert.equal(updates.length, 0, "passive requests must never activate");
      queue.push(queued); dispatch = true;
      for (let i = 0; i < 150 && !reply; i++) await new Promise((r) => setTimeout(r, 10));
      assert.ok(reply, "command replied");
      if (["late-reply", "activate", "already-ready"].includes(scenario)) {
        assert.deepEqual(scripts, ["observe"]); assert.equal(reply.id, o.id);
        assert.equal(active && focused && state === "normal", true);
        assert.equal(updates.length, scenario === "already-ready" ? 0 : 3);
        if (scenario === "late-reply") {
          await new Promise((r) => setTimeout(r, 300));
          const status = (await send({ type: "panelStatus", windowId: 2 })).result;
          assert.equal(status.adapterOwned, true, "late reply must preserve local connection");
        }
      } else if (scenario === "post-focus-loss") {
        assert.equal(scripts.length, 1); assert.match(reply.error, /changed|unfocused/);
        assert.equal(updates.length, 0, "no post-dispatch focus recovery/replay");
      } else {
        assert.equal(scripts.length, 0);
        if (scenario === "stale-action") {
          assert.equal(reply.delivery, "not-sent");
          assert.equal(reply.reason, "adapter-pre-dispatch-refusal:chrome-document-binding-expired");
        } else assert.match(reply.error, /activation-failed|changed|mismatch/);
        if (["disconnect", "expired", "activation-fails"].includes(scenario)) assert.equal(updates.length, 1);
        if (scenario === "moved") assert.equal(updates.length, 0);
        assert.equal(JSON.stringify(reply).includes("private-browser-detail"), false);
      }
    } finally {
      if (send) await send({ type: "disconnect" });
      await new Promise((r) => setTimeout(r, 300));
      globalThis.chrome = saved.chrome; globalThis.fetch = saved.fetch;
    }
  });
}
