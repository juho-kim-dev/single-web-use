import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test(
  "real CLI process init/serve/status and stdio MCP share private connector, without secret output",
  { timeout: 15000 },
  async (t) => {
    const root = await mkdtemp(path.join(os.tmpdir(), "swu-cli-test-")),
      env = { ...process.env, SWU_HOME: root };
    t.after(() =>
      rm(root, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      }),
    );
    const start = (args) => {
      const p = spawn(process.execPath, ["src/cli.js", ...args], {
        env,
        windowsHide: true,
      });
      p.out = "";
      p.err = "";
      p.stdout.on("data", (d) => (p.out += d));
      p.stderr.on("data", (d) => (p.err += d));
      return p;
    };
    const init = start(["init", "a".repeat(32)]);
    assert.equal((await once(init, "exit"))[0], 0);
    const file = path.join(root, "connector.json"),
      config = JSON.parse(await readFile(file, "utf8"));
    assert.ok(!init.out.includes(config.token));
    const probe = http.createServer();
    probe.listen(0, "127.0.0.1");
    await once(probe, "listening");
    config.port = probe.address().port;
    await new Promise((r) => probe.close(r));
    await writeFile(file, JSON.stringify(config));
    const server = start(["serve"]);
    t.after(() => server.kill());
    for (let i = 0; i < 100 && !server.err.includes("listening"); i++)
      await new Promise((r) => setTimeout(r, 10));
    assert.match(server.err, /listening/);
    assert.ok(!server.err.includes(config.token));
    const status = start(["status"]);
    assert.equal((await once(status, "exit"))[0], 0);
    assert.equal(JSON.parse(status.out).connected, false);
    const mcp = start(["mcp"]);
    t.after(() => mcp.kill());
    mcp.stdin.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "status", arguments: {} },
      }) + "\n",
    );
    for (let i = 0; i < 100 && !mcp.out.includes("\n"); i++)
      await new Promise((r) => setTimeout(r, 10));
    const response = JSON.parse(mcp.out.trim());
    assert.equal(JSON.parse(response.result.content[0].text).connected, false);
    assert.ok(!mcp.out.includes(config.token));
    mcp.stdin.end();
    await once(mcp, "exit");
    server.kill();
    await once(server, "exit");
  },
);
