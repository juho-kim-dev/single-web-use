import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { waitFor } from "./helpers.js";
test("toolbar opens panel synchronously in gesture, binds clicked tab only, and never binds on lifecycle events", async (t) => {
  const saved = { chrome: globalThis.chrome, fetch: globalThis.fetch };
  t.after(() => {
    globalThis.chrome = saved.chrome;
    globalThis.fetch = saved.fetch;
  });
  for (const scenario of [
    "ready",
    "pairing",
    "paused",
    "fenced",
    "disconnected",
    "offline",
    "bad-session",
    "open-failed",
  ]) {
    let clicked, listener, lastError, releasePoll;
    const routes = [],
      trace = [],
      events = [];
    const pollGate = new Promise((r) => (releasePoll = r)),
      event = { addListener: (f) => events.push(f) };
    const stored = { userDisconnected: scenario === "disconnected" };
    globalThis.chrome = {
      action: { onClicked: { addListener: (f) => (clicked = f) } },
      sidePanel: {
        open: (o) => {
          trace.push(["open", o]);
          return scenario === "open-failed"
            ? Promise.reject(Error("PRIVATE_SENTINEL"))
            : Promise.resolve();
        },
      },
      storage: {
        local: {
          get: async () => ({
            token: scenario === "pairing" ? undefined : "a".repeat(64),
          }),
        },
        session: {
          get: async () => stored,
          set: async (v) => {
            Object.assign(stored, v);
            lastError = v.lastError;
          },
        },
      },
      runtime: {
        id: "test",
        getURL: (p) => "chrome-extension://test/" + p,
        onMessage: { addListener: (f) => (listener = f) },
      },
      tabs: {
        get: async (id) => {
          trace.push(["get", id]);
          return { active: true, windowId: 7, url: "https://example.com/" };
        },
        query: async () => {
          assert.fail("toolbar must use clicked tab, not current window query");
        },
        onActivated: event,
        onUpdated: event,
        onRemoved: event,
      },
      windows: {
        get: async (id) => ({ focused: true, state: "normal" }),
        onFocusChanged: event,
      },
      scripting: {
        executeScript: async () => {
          assert.fail("connection must not inject");
        },
      },
    };
    globalThis.fetch = async (url, options) => {
      const route = new URL(url).pathname,
        body = JSON.parse(options.body);
      routes.push({ route, body });
      if (route === "/bridge/poll") {
        await pollGate;
        throw Error("fixture-stop");
      }
      if (scenario === "offline") throw Error("offline");
      return {
        json: async () => ({
          result:
            route === "/api"
              ? {
                  connected: false,
                  session: null,
                  bindProtocol: "guarded-auto-v1",
                  binding: null,
                  paused: scenario === "paused",
                  fenced: scenario === "fenced",
                }
              : { session: scenario === "bad-session" ? undefined : "owned" },
        }),
      };
    };
    await import("../extension/worker.js?toolbar=" + scenario);
    assert.equal(routes.length, 0);
    events.forEach((f) => f({ tabId: 12 }, {}));
    assert.equal(routes.length, 0);
    clicked({ id: 42, windowId: 7 });
    assert.deepEqual(trace[0], ["open", { windowId: 7 }]);
    assert.equal(trace.length, 1);
    if (scenario === "ready") {
      await waitFor(() => routes.some((r) => r.route === "/bridge/poll"));
      const bind = routes.find((r) => r.route === "/bridge/bind");
      assert.deepEqual(bind.body, {
        tabId: 42,
        windowId: 7,
        intent: "automatic",
        observedSession: null,
      });
      assert.ok(trace.filter((x) => x[0] === "get").every((x) => x[1] === 42));
      releasePoll();
      await waitFor(() => lastError === "fixture-stop");
    } else {
      await waitFor(() => !!lastError);
      assert.equal(
        routes.some((r) => r.route === "/bridge/bind"),
        scenario === "bad-session",
      );
    }
    // A forged extension-page sender cannot request binding or API calls.
    let answered = false;
    const before = routes.length;
    listener(
      { type: "api", method: "observe", args: {} },
      { id: "test", url: "chrome-extension://test/other.html" },
      () => (answered = true),
    );
    assert.equal(answered, false);
    assert.equal(routes.length, before);
  }
});
test("manual sidebar bind requires and uses its own window identifier", async (t) => {
  const saved = { chrome: globalThis.chrome, fetch: globalThis.fetch };
  t.after(() => {
    globalThis.chrome = saved.chrome;
    globalThis.fetch = saved.fetch;
  });
  let listener, queried;
  const event = { addListener() {} };
  globalThis.chrome = {
    storage: {
      session: { set: async () => {}, get: async () => ({}) },
      local: { get: async () => ({ token: "a".repeat(64) }) },
    },
    runtime: {
      id: "test",
      getURL: (p) => "chrome-extension://test/" + p,
      onMessage: { addListener: (f) => (listener = f) },
    },
    tabs: {
      query: async (o) => {
        queried = o;
        return [];
      },
      onActivated: event,
      onUpdated: event,
      onRemoved: event,
    },
    windows: { onFocusChanged: event },
  };
  globalThis.fetch = async () => {
    assert.fail("missing target must not contact runtime");
  };
  await import("../extension/worker.js?manual-panel-window");
  const send = (m) =>
    new Promise((r) =>
      listener(m, { id: "test", url: "chrome-extension://test/popup.html" }, r),
    );
  assert.equal((await send({ type: "bind" })).error, "panel-window-required");
  assert.equal(
    (await send({ type: "bind", windowId: 7 })).error,
    "connect-tab-not-found",
  );
  assert.deepEqual(queried, { active: true, windowId: 7 });
});
test("sidebar manifest and disclosure preserve existing editors without a fixed-width popup or raw primary view", async () => {
  const m = JSON.parse(
    await readFile(
      new URL("../extension/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(m.action.default_popup, undefined);
  assert.deepEqual(m.permissions, [
    "activeTab",
    "scripting",
    "storage",
    "sidePanel",
  ]);
  assert.equal(m.side_panel.default_path, "popup.html");
  const html = await readFile(
      new URL("../extension/popup.html", import.meta.url),
      "utf8",
    ),
    css = await readFile(
      new URL("../extension/popup.css", import.meta.url),
      "utf8",
    ),
    js = await readFile(
      new URL("../extension/popup.js", import.meta.url),
      "utf8",
    );
  assert.ok(!/<details|<summary/.test(html));
  assert.ok(!css.includes("610px"));
  const emptyState = html.match(
    /id="readingContent"[^>]*>([\s\S]*?)<\/div>/,
  )[1];
  assert.equal(emptyState, emptyState.trim());
  assert.ok(!emptyState.includes("\n"));

  assert.ok(html.includes('id="readAdvanced" hidden'));
  assert.ok(html.includes('id="packAdvanced" hidden'));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((x) => x[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of [...js.matchAll(/\$\("([^"]+)"\)/g)].map((x) => x[1]))
    assert.ok(ids.includes(id), id);
  for (const id of [
    "editor",
    "test",
    "activate",
    "archivePack",
    "restorePack",
    "pageReadRun",
    "documentAppend",
    "token",
    "operationId",
    "observation",
    "packResult",
  ])
    assert.ok(ids.includes(id), id);
});

test("panel status requires matching local ownership, current foreground, and clears recovered connection errors", async (t) => {
  const saved = { chrome: globalThis.chrome, fetch: globalThis.fetch };
  t.after(() => {
    globalThis.chrome = saved.chrome;
    globalThis.fetch = saved.fetch;
  });
  let listener,
    releasePoll,
    active = true,
    remoteSession = "owned",
    delayFlags = false,
    flagsEntered,
    releaseFlags;
  const flagsReady = new Promise((r) => (flagsEntered = r)),
    flagsGate = new Promise((r) => (releaseFlags = r));
  const stored = { lastError: "bound-window-unfocused" },
    gate = new Promise((r) => (releasePoll = r)),
    event = { addListener() {} };
  globalThis.chrome = {
    storage: {
      local: { get: async () => ({ token: "a".repeat(64) }) },
      session: {
        get: async (key) => {
          if (delayFlags && Array.isArray(key)) {
            flagsEntered();
            await flagsGate;
          }
          return stored;
        },
        set: async (v) => Object.assign(stored, v),
      },
    },
    runtime: {
      id: "test",
      getURL: (p) => "chrome-extension://test/" + p,
      onMessage: { addListener: (f) => (listener = f) },
    },
    tabs: {
      query: async () => [{ id: 42, windowId: 7 }],
      get: async () => ({ active, windowId: 7, url: "https://example.com/" }),
      onActivated: event,
      onUpdated: event,
      onRemoved: event,
    },
    windows: {
      get: async () => ({ focused: true, state: "normal" }),
      onFocusChanged: event,
    },
  };
  globalThis.fetch = async (url) => {
    const route = new URL(url).pathname;
    if (route === "/bridge/poll") {
      await gate;
      throw Error("fixture-stop");
    }
    return {
      json: async () => ({
        result:
          route === "/bridge/bind"
            ? { session: "owned" }
            : {
                version: "0.6.0",
                bindProtocol: "guarded-auto-v1",
                connected: true,
                session: remoteSession,
                binding: { tabId: 42, windowId: 7 },
              },
      }),
    };
  };
  await import("../extension/worker.js?panel-owned-status");
  const send = (m) =>
    new Promise((r) =>
      listener(m, { id: "test", url: "chrome-extension://test/popup.html" }, r),
    );
  let state = (await send({ type: "panelStatus", windowId: 7 })).result;
  assert.equal(state.adapterOwned, false);
  assert.equal(state.foregroundReady, false);
  await send({ type: "bind", windowId: 7 });
  assert.equal(stored.lastError, null);
  state = (await send({ type: "panelStatus", windowId: 7 })).result;
  assert.equal(state.adapterOwned, true);
  assert.equal(state.foregroundReady, true);
  active = false;
  state = (await send({ type: "panelStatus", windowId: 7 })).result;
  assert.equal(state.foregroundReady, false);
  active = true;
  remoteSession = "another-owner";
  state = (await send({ type: "panelStatus", windowId: 7 })).result;
  assert.equal(state.adapterOwned, false);
  assert.equal(state.foregroundReady, false);
  remoteSession = "owned";
  delayFlags = true;
  const waiting = send({ type: "panelStatus", windowId: 7 });
  await flagsReady;
  await send({ type: "disconnect" });
  releaseFlags();
  state = (await waiting).result;
  assert.equal(state.adapterOwned, false);
  assert.equal(state.foregroundReady, false);
  delayFlags = false;
  releasePoll();
  await waitFor(() => stored.lastError === "fixture-stop");
  await import("../extension/worker.js?panel-owned-status-restarted");
  state = (await send({ type: "panelStatus", windowId: 7 })).result;
  assert.equal(state.adapterOwned, false);
  assert.equal(state.foregroundReady, false);
});
