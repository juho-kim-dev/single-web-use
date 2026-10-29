import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { Runtime } from "../src/runtime.js";
import { createServer } from "../src/server.js";
const config = {
  port: 47831,
  extensionId: "b".repeat(32),
  token: "a".repeat(64),
};
const runtime = () => new Runtime({ data: { packs: {}, operations: {} } });
function post(server, body) {
  return new Promise((resolve) => {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]);
    req.method = "POST";
    req.url = "/bridge/bind";
    req.headers = {
      host: "127.0.0.1:47831",
      origin: "chrome-extension://" + config.extensionId,
      "x-swu-extension": config.extensionId,
      authorization: "Bearer " + config.token,
      "content-type": "application/json",
    };
    let status = 200;
    server.emit("request", req, {
      setHeader() {},
      writeHead(s) {
        status = s;
      },
      end(s) {
        resolve({ status, ...JSON.parse(s) });
      },
    });
  });
}
test("automatic bridge bind atomically refuses pause/fence/session/busy changes after status without replacing owner", async () => {
  for (const mode of [
    "pause",
    "fence",
    "session",
    "pending",
    "queued",
    "inflight",
  ]) {
    const r = runtime(),
      server = createServer(r, config),
      observed = await r.call("status", {});
    let release,
      blocked,
      rejected = false;
    if (mode === "pause") r.paused = true;
    if (mode === "fence") r.fenced = true;
    if (mode === "session") r.bind({ tabId: 8, windowId: 9 });
    if (mode === "pending")
      r.pending = {
        reject() {
          rejected = true;
        },
      };
    if (mode === "inflight") r.inFlight.set("queued-input", 1);
    if (mode === "queued")
      blocked = r.serial(() => new Promise((resolve) => (release = resolve)));
    const owner = r.session,
      binding = r.binding,
      pending = r.pending;
    const response = await post(server, {
      tabId: 1,
      windowId: 2,
      intent: "automatic",
      observedSession: observed.session,
    });
    assert.equal(response.status, 400);
    assert.equal(
      response.error,
      mode === "pause"
        ? "automatic-bind-paused"
        : mode === "fence"
          ? "automatic-bind-fenced"
          : mode === "session"
            ? "automatic-bind-session-changed"
            : "automatic-bind-busy",
    );
    assert.equal(r.session, owner);
    assert.equal(r.binding, binding);
    assert.equal(r.pending, pending);
    assert.equal(rejected, false);
    if (mode === "fence") assert.equal(r.fenced, true);
    if (blocked) {
      release();
      await blocked;
    }
  }
});
test("automatic binds preserve established owners, reject malformed contracts, and manual recovery remains explicit", async () => {
  const r = runtime(),
    server = createServer(r, config);
  assert.equal((await r.call("status", {})).bindProtocol, "guarded-auto-v1");
  const accepted = await post(server, {
    tabId: 1,
    windowId: 2,
    intent: "automatic",
    observedSession: null,
  });
  assert.equal(accepted.status, 200);
  assert.equal(r.session, accepted.result.session);
  assert.deepEqual(r.binding, { tabId: 1, windowId: 2 });
  const owner = r.session;
  const refused = await post(server, {
    tabId: 3,
    windowId: 2,
    intent: "automatic",
    observedSession: owner,
  });
  assert.equal(refused.error, "automatic-bind-owner-exists");
  assert.equal(r.session, owner);
  for (const request of [
    { tabId: 3, windowId: 2, intent: "automatic" },
    { tabId: 3, windowId: 2, intent: "automatic", observedSession: "old" },
    { tabId: 3, windowId: 2, automatic: true },
  ]) {
    assert.equal((await post(server, request)).error, "invalid-request-schema");
    assert.equal(r.session, owner);
  }
  r.fenced = true;
  const late = await post(server, {
    tabId: 3,
    windowId: 2,
    intent: "automatic",
    observedSession: owner,
  });
  assert.equal(late.error, "automatic-bind-fenced");
  assert.equal(r.fenced, true);
  const manual = await post(server, { tabId: 3, windowId: 2 });
  assert.equal(manual.status, 200);
  assert.notEqual(r.session, owner);
  assert.equal(r.fenced, false);
});
