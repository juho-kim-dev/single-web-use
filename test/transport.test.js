import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { createServer } from "../src/server.js";
import { handle } from "../src/mcp.js";
import { fixture, observation } from "./helpers.js";

test("actual HTTP transport authenticates bridge, rejects website/Host/token and delivers observation once", async (t) => {
  const { runtime } = await fixture(t, 500),
    config = { port: 0, extensionId: "a".repeat(32), token: "b".repeat(64) },
    server = createServer(runtime, config);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  config.port = server.address().port;
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${config.port}`;
  const post = (route, body, headers = {}) =>
    fetch(base + route, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.token}`,
        ...headers,
      },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await post(
        "/api",
        { method: "status", args: {} },
        { origin: "https://hostile.example" },
      )
    ).status,
    403,
  );
  const badHost = await new Promise((resolve, reject) => {
    const r = http.request(
      base + "/api",
      { method: "POST", headers: { host: "localhost:" + config.port } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    r.on("error", reject);
    r.end("{}");
  });
  assert.equal(badHost, 403);
  assert.equal(
    (
      await post(
        "/api",
        { method: "status", args: {} },
        { authorization: "Bearer wrong" },
      )
    ).status,
    403,
  );
  assert.equal(
    (await post("/bridge/bind", { tabId: 1, windowId: 2 })).status,
    400,
  );
  const extension = {
    origin: `chrome-extension://${config.extensionId}`,
    "x-swu-extension": config.extensionId,
  };
  const {
    result: { session },
  } = await (
    await post("/bridge/bind", { tabId: 1, windowId: 2 }, extension)
  ).json();
  const read = post("/api", { method: "observe", args: {} });
  let command;
  for (let i = 0; i < 30 && !command; i++) {
    const r = await (await post("/bridge/poll", { session }, extension)).json();
    command = r.result.command;
  }
  assert.ok(command);
  assert.equal(
    (await (await post("/bridge/poll", { session }, extension)).json()).result
      .command,
    null,
  );
  await post(
    "/bridge/reply",
    { session, id: command.id, result: observation({ session }) },
    extension,
  );
  assert.equal((await (await read).json()).result.session, session);
  assert.equal(
    (
      await post(
        "/bridge/reply",
        { session, id: command.id, result: {} },
        extension,
      )
    ).status,
    400,
  );
});
test("MCP discovery exports real strict schemas, calls same API and rejects malformed/unknown messages", async () => {
  const init = await handle({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18" },
  });
  assert.equal(init.result.protocolVersion, "2025-06-18");
  const list = await handle({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.ok(
    list.result.tools.find((t) => t.name === "packRun").inputSchema.properties
      .arguments,
  );
  const response = await handle(
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "status", arguments: {} },
    },
    async (name, args) => ({ name, args }),
  );
  assert.equal(response.result.isError, false);
  const bad = await handle({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "act", arguments: {} },
  });
  assert.equal(bad.result.isError, true);
  assert.equal(
    (await handle({ jsonrpc: "2.0", id: 5, method: "other" })).error.code,
    -32601,
  );
  assert.equal(
    await handle({ jsonrpc: "2.0", method: "notifications/initialized" }),
    null,
  );
});
