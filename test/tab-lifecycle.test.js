import test from "node:test";
import assert from "node:assert/strict";
import { Runtime } from "../src/runtime.js";
import { waitFor, fixture, observation } from "./helpers.js";

for (const cause of [
  "removed",
  "replaced",
  "missing",
  "observe-missing",
  "act-missing",
  "lost-refusal",
  "transient",
  "late-bind",
  "late-cleanup",
  "cleanup-failure",
]) {
  test(`owned tab lifecycle: ${cause}`, async (t) => {
    const saved = { chrome: globalThis.chrome, fetch: globalThis.fetch };
    t.after(() => Object.assign(globalThis, saved));
    const connected = ["act-missing", "lost-refusal"].includes(cause);
    const runtime = connected
      ? (await fixture(t)).runtime
      : new Runtime({ data: { packs: {}, operations: {} } });
    const events = {},
      polls = [],
      stored = {},
      routes = [];
    let listener,
      clicked,
      mode = "ready",
      scripts = 0,
      releaseBind,
      bindEntered;
    const bindReady = new Promise((r) => (bindEntered = r));
    const bindGate = new Promise((r) => (releaseBind = r));
    let releaseCleanup, cleanupEntered;
    const cleanupReady = new Promise((r) => (cleanupEntered = r));
    const cleanupGate = new Promise((r) => (releaseCleanup = r));
    const event = (name) => ({ addListener: (fn) => (events[name] = fn) });
    globalThis.chrome = {
      action: { onClicked: { addListener: (fn) => (clicked = fn) } },
      sidePanel: { open: async () => {} },
      storage: {
        local: { get: async () => ({ token: "a".repeat(64) }) },
        session: {
          get: async () => stored,
          set: async (v) => Object.assign(stored, v),
        },
      },
      runtime: {
        id: "test",
        getURL: (p) => "chrome-extension://test/" + p,
        onMessage: { addListener: (fn) => (listener = fn) },
      },
      tabs: {
        query: async () => [{ id: 1, windowId: 2 }],
        get: async () => {
          if (mode === "missing") throw Error("No tab with id: 1.");
          if (mode === "transient") throw Error("PRIVATE_SENTINEL");
          return { active: true, windowId: 2, url: "https://example.com/" };
        },
        onActivated: event("active"),
        onRemoved: event("removed"),
        onReplaced: event("replaced"),
        onUpdated: event("updated"),
      },
      windows: {
        get: async () => ({ focused: true, state: "normal" }),
        onFocusChanged: event("focus"),
      },
      scripting: {
        executeScript: async () => {
          scripts++;
          assert.fail("no injection");
        },
      },
    };
    globalThis.fetch = async (url, options) => {
      const route = new URL(url).pathname,
        body = JSON.parse(options.body);
      routes.push({ route, body });
      let result;
      try {
        if (route === "/bridge/bind") {
          result = runtime.bind(body);
          if (cause === "late-bind") {
            bindEntered();
            await bindGate;
          }
        } else if (route === "/bridge/disconnect-owned") {
          if (cause === "late-cleanup") {
            cleanupEntered();
            await cleanupGate;
          }
          if (cause === "cleanup-failure") throw Error("fixture-offline");
          runtime.disconnect("browser-disconnected", body.expectedSession);
          result = { disconnected: true };
        } else if (route === "/bridge/reply" && connected) {
          if (cause === "lost-refusal") throw Error("fixture-reply-lost");
          result = runtime.reply(body.session, body.id, body.result);
        } else if (route === "/bridge/poll") {
          result = await new Promise((resolve) => polls.push(resolve));
        } else result = await runtime.call("status", {});
        return { json: async () => ({ result }) };
      } catch (e) {
        return { json: async () => ({ error: e.message }) };
      }
    };
    await import(`../extension/worker.js?lifecycle=${cause}`);
    const send = (message) =>
      new Promise((resolve) =>
        listener(
          message,
          { id: "test", url: "chrome-extension://test/popup.html" },
          resolve,
        ),
      );
    const bind = send({ type: "bind", windowId: 2 });
    if (cause === "late-bind") {
      await bindReady;
      events.removed(1);
      releaseBind();
      assert.equal((await bind).error, "binding-changed-during-connect");
      assert.equal(runtime.session, null);
      return;
    }
    await bind;
    await waitFor(() => polls.length === 1);
    const original = runtime.session;
    events.removed(999);
    assert.equal((await send({ type: "status" })).result.connected, true);
    if (connected) {
      const before = runtime.retain(observation({ session: original }));
      const task = runtime.call("act", {
        operationId: "missing-input",
        observationId: before.id,
        target: "n1",
        kind: "fill",
        text: "test",
        expectedValue: "",
        intent: "edit-field",
      });
      await waitFor(() => runtime.pending);
      mode = "missing";
      polls[0](runtime.poll(original));
      const receipt = await task;
      await waitFor(() => runtime.session === null);
      assert.equal(
        receipt.delivery,
        cause === "lost-refusal" ? "unknown" : "not-sent",
      );
      assert.equal(runtime.fenced, cause === "lost-refusal");
      assert.equal(
        runtime.store.data.operations["missing-input"].receipt.delivery,
        receipt.delivery,
      );
      assert.equal(scripts, 0);
      const sequence = routes.map((r) => r.route);
      assert.ok(
        sequence.indexOf("/bridge/reply") <
          sequence.indexOf("/bridge/disconnect-owned"),
      );
      assert.equal(sequence.includes("/bridge/disconnect"), false);
      return;
    }
    if (cause === "observe-missing") {
      mode = "missing";
      polls[0]({
        command: {
          id: "missing-observe",
          kind: "observe",
          session: original,
          deadline: Date.now() + 5000,
          args: {},
        },
      });
      await waitFor(() => routes.some((r) => r.route === "/bridge/reply"));
      assert.equal(
        routes.find((r) => r.route === "/bridge/reply").body.result.error,
        "bound-tab-not-found",
      );
      assert.equal(runtime.session, null);
      assert.equal((await send({ type: "status" })).result.connected, false);
      assert.equal(scripts, 0);
      return;
    }
    if (["late-cleanup", "cleanup-failure"].includes(cause)) {
      events.removed(1);
      if (cause === "late-cleanup") {
        await cleanupReady;
        const newer = runtime.bind({ tabId: 9, windowId: 2 }).session;
        releaseCleanup();
        await waitFor(() => stored.lastError === "binding-cleanup-unconfirmed");
        assert.equal(runtime.session, newer);
      } else {
        await waitFor(() => stored.lastError === "binding-cleanup-unconfirmed");
        assert.equal(runtime.session, original);
      }
      assert.equal((await send({ type: "status" })).result.connected, false);
      const state = (await send({ type: "panelStatus", windowId: 2 })).result;
      assert.equal(state.adapterOwned, false);
      assert.equal(state.foregroundReady, false);
      for (const release of polls) release({ command: null });
      runtime.disconnect();
      return;
    }
    if (cause === "removed") events.removed(1);
    if (cause === "replaced") events.replaced(3, 1);
    if (["missing", "transient"].includes(cause)) {
      mode = cause;
      const state = (await send({ type: "panelStatus", windowId: 2 })).result;
      assert.equal(state.foregroundReady, false);
      assert.equal(stored.lastError.includes("PRIVATE"), false);
    }
    if (cause === "transient") {
      assert.equal(runtime.session, original);
      await send({ type: "disconnect" });
      assert.equal(stored.userDisconnected, true);
    } else {
      await waitFor(() => runtime.session === null);
      assert.equal(stored.userDisconnected, false);
      assert.equal((await send({ type: "status" })).result.connected, false);
      assert.equal(routes.filter((r) => r.route === "/bridge/bind").length, 1);
      mode = "ready";
      clicked({ id: 3, windowId: 2 });
      await waitFor(() => polls.length === 2);
      assert.equal(runtime.binding.tabId, 3);
      // Releasing the previous poll cannot execute or retire this new owner.
      polls[0]({ command: { kind: "observe", session: original } });
      assert.equal(scripts, 0);
      await send({ type: "disconnect" });
    }
    for (const release of polls) release({ command: null });
    assert.equal(runtime.session, null);
    assert.equal(scripts, 0);
  });
}
