import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "./helpers.js";

test("worker foreground diagnostics distinguish refusals without bind traffic/scripts and recover explicitly", async (t) => {
  const saved = { chrome: globalThis.chrome, fetch: globalThis.fetch };
  t.after(() => {
    globalThis.chrome = saved.chrome;
    globalThis.fetch = saved.fetch;
  });
  const cases = [
    ["query-failure", "connect-tab-query-failed"],
    ["no-tab", "connect-tab-not-found"],
    ["missing-get", "bound-tab-unavailable"],
    ["get-failure", "bound-tab-unavailable"],
    ["missing-window", "bound-window-unavailable"],
    ["window-failure", "bound-window-unavailable"],
    ["inactive", "bound-tab-inactive"],
    ["window-mismatch", "bound-tab-window-mismatch"],
    ["unfocused", "bound-window-unfocused"],
    ["minimized", "bound-window-minimized"],
    ["missing-url", "bound-tab-url-unavailable"],
    ["non-http", "bound-tab-url-not-http"],
    ["bind-rejected", "fixture-bind-rejected"],
  ];
  for (const [initial, expected] of cases) {
    let mode = initial,
      listener,
      scripts = 0,
      network = [],
      releasePoll,
      lastError;
    const pollGate = new Promise((r) => (releasePoll = r)),
      event = { addListener() {} };
    globalThis.chrome = {
      storage: {
        local: { get: async () => ({ token: "a".repeat(64) }) },
        session: {
          get: async () => ({ lastError }),
          set: async (v) => {
            lastError = v.lastError;
          },
        },
      },
      runtime: {
        id: "test",
        getURL: (p) => "chrome-extension://test/" + p,
        onMessage: { addListener: (fn) => (listener = fn) },
      },
      tabs: {
        query: async () => {
          if (mode === "query-failure") throw Error("PRIVATE_SENTINEL");
          return mode === "no-tab" ? [] : [{ id: 1, windowId: 2 }];
        },
        get: async () => {
          if (mode === "get-failure") throw Error("PRIVATE_SENTINEL");
          if (mode === "missing-get") return undefined;
          return {
            active: mode !== "inactive",
            windowId: mode === "window-mismatch" ? 3 : 2,
            ...(mode === "missing-url"
              ? {}
              : {
                  url:
                    mode === "non-http"
                      ? "chrome://newtab/"
                      : "https://example.com/private?secret=PRIVATE_SENTINEL",
                }),
          };
        },
        onActivated: event,
        onRemoved: event,
        onUpdated: event,
      },
      windows: {
        get: async () => {
          if (mode === "window-failure") throw Error("PRIVATE_SENTINEL");
          return mode === "missing-window"
            ? undefined
            : {
                focused: mode !== "unfocused",
                state: mode === "minimized" ? "minimized" : "normal",
              };
        },
        onFocusChanged: event,
      },
      scripting: {
        executeScript: async () => {
          scripts++;
          throw Error("unexpected-script");
        },
      },
    };
    globalThis.fetch = async (url, options) => {
      const route = new URL(url).pathname;
      network.push({ route, body: JSON.parse(options.body) });
      if (route === "/bridge/poll") {
        await pollGate;
        throw Error("fixture-stop");
      }
      if (route === "/bridge/bind" && mode === "bind-rejected")
        return { json: async () => ({ error: "fixture-bind-rejected" }) };
      return {
        json: async () => ({
          result: route === "/bridge/bind" ? { session: "owned" } : {},
        }),
      };
    };
    await import("../extension/worker.js?diagnostics=" + initial);
    const send = (m) =>
      new Promise((r) =>
        listener(
          m,
          { id: "test", url: "chrome-extension://test/popup.html" },
          r,
        ),
      );
    const refused = await send({ type: "bind" });
    assert.equal(refused.error, expected);
    assert.equal(JSON.stringify(refused).includes("PRIVATE_SENTINEL"), false);
    assert.equal(network.length, initial === "bind-rejected" ? 1 : 0);
    assert.equal(scripts, 0);
    assert.equal((await send({ type: "status" })).result.connected, false);
    mode = "valid";
    assert.equal((await send({ type: "bind" })).result.connected, true);
    assert.equal(
      network.filter((n) => n.route === "/bridge/bind").length,
      initial === "bind-rejected" ? 2 : 1,
    );
    assert.deepEqual(network[0].body, { tabId: 1, windowId: 2 });
    assert.equal(scripts, 0);
    releasePoll();
    await waitFor(() => lastError === "fixture-stop");
    assert.equal((await send({ type: "status" })).result.connected, false);
  }
});

for (const phase of ["query", "foreground"]) {
  test(`worker rejects overlapping binds and disconnect during ${phase} prevents bind dispatch`, async (t) => {
    const saved = { chrome: globalThis.chrome, fetch: globalThis.fetch };
    t.after(() => {
      globalThis.chrome = saved.chrome;
      globalThis.fetch = saved.fetch;
    });
    let listener,
      entered,
      release,
      routes = [];
    const ready = new Promise((r) => (entered = r)),
      gate = new Promise((r) => (release = r)),
      event = { addListener() {} };
    globalThis.chrome = {
      storage: {
        local: { get: async () => ({ token: "a".repeat(64) }) },
        session: { get: async () => ({}), set: async () => {} },
      },
      runtime: {
        id: "test",
        getURL: (p) => "chrome-extension://test/" + p,
        onMessage: { addListener: (f) => (listener = f) },
      },
      tabs: {
        query: async () => {
          if (phase === "query") {
            entered();
            await gate;
          }
          return [{ id: 1, windowId: 2 }];
        },
        get: async () => {
          if (phase === "foreground") {
            entered();
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
          assert.fail("must not inject");
        },
      },
    };
    globalThis.fetch = async (url) => {
      routes.push(new URL(url).pathname);
      return { json: async () => ({ result: {} }) };
    };
    await import("../extension/worker.js?diagnostics-overlap-" + phase);
    const send = (m) =>
      new Promise((r) =>
        listener(
          m,
          { id: "test", url: "chrome-extension://test/popup.html" },
          r,
        ),
      );
    const connecting = send({ type: "bind" });
    await ready;
    assert.equal(
      (await send({ type: "bind" })).error,
      "disconnect-before-rebind",
    );
    await send({ type: "disconnect" });
    release();
    assert.equal((await connecting).error, "binding-changed-during-connect");
    assert.deepEqual(routes, ["/bridge/disconnect"]);
    assert.equal((await send({ type: "status" })).result.connected, false);
  });
}
