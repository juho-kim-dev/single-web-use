import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { fixture, observation, pending } from "./helpers.js";
import { Runtime } from "../src/runtime.js";
import { createServer } from "../src/server.js";
const config = {
  port: 47831,
  extensionId: "b".repeat(32),
  token: "a".repeat(64),
};
const runtime = () => new Runtime({ data: { packs: {}, operations: {} } });
function post(server, body, route = "/bridge/bind") {
  return new Promise((resolve) => {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]);
    req.method = "POST";
    req.url = route;
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

test("disconnect requires exact session, preserves newer owner and fences leased input", async () => {
  const r = runtime(),
    server = createServer(r, config);
  const old = r.bind({ tabId: 1, windowId: 2 }).session;
  assert.equal(
    (await post(server, { expectedSession: old }, "/bridge/disconnect")).error,
    "unknown-route",
  );
  assert.equal(r.session, old);
  const newer = r.bind({ tabId: 3, windowId: 2 }).session;
  assert.equal(
    (await post(server, {}, "/bridge/disconnect-owned")).error,
    "invalid-request-schema",
  );
  assert.equal(
    (await post(server, { expectedSession: old }, "/bridge/disconnect-owned"))
      .error,
    "disconnect-session-changed",
  );
  assert.equal(r.session, newer);
  let rejected = false;
  r.pending = {
    leased: true,
    command: { kind: "act" },
    reject() {
      rejected = true;
    },
  };
  r.paused = true;
  assert.equal(
    (await post(server, { expectedSession: newer }, "/bridge/disconnect-owned"))
      .result.disconnected,
    true,
  );
  assert.equal(rejected, true);
  assert.equal(r.session, null);
  assert.equal(r.fenced, true);
  assert.equal(r.paused, true);
});

test("target loss during leased input persists unknown receipt and blocks automatic replay", async (t) => {
  const { runtime: r, session, store } = await fixture(t);
  const o = r.retain(observation({ session }));
  const task = r.call("act", {
    operationId: "lost-target",
    observationId: o.id,
    target: "n1",
    kind: "fill",
    text: "test",
    expectedValue: "",
    intent: "edit-field",
  });
  await pending(r);
  r.disconnect("browser-disconnected", session);
  const receipt = await task;
  assert.equal(receipt.delivery, "unknown");
  assert.equal(
    store.data.operations["lost-target"].receipt.delivery,
    "unknown",
  );
  assert.equal(r.fenced, true);
  assert.throws(
    () =>
      r.bind({
        tabId: 3,
        windowId: 2,
        intent: "automatic",
        observedSession: null,
      }),
    /automatic-bind-fenced/,
  );
});

test("disconnect after reply before retaining act-after still fences unknown delivery", async (t) => {
  const { runtime: r, session } = await fixture(t);
  const o = r.retain(observation({ session }));
  const task = r.call("act", {
    operationId: "lost-after-reply",
    observationId: o.id,
    target: "n1",
    kind: "fill",
    text: "test",
    expectedValue: "",
    intent: "edit-field",
  });
  const command = await pending(r);
  r.reply(session, command.id, {
    accepted: true,
    delivery: "synthetic-dispatched",
    outcome: "unknown",
    reason: "dispatched",
    after: observation({ session }),
  });
  r.disconnect("browser-disconnected", session);
  assert.equal((await task).delivery, "unknown");
  assert.equal(r.fenced, true);
});
