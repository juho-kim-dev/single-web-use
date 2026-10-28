#!/usr/bin/env node
import { readFile, writeFile, open, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { StateStore, privateDirectory } from "./storage.js";
import { Runtime } from "./runtime.js";
import { createServer } from "./server.js";
import { call, config, dataRoot } from "./client.js";
import { serveMCP } from "./mcp.js";

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "init") {
    const extensionId = args[0];
    if (!/^[a-p]{32}$/.test(extensionId ?? ""))
      throw Error("usage: swu init EXTENSION_ID");
    const root = dataRoot();
    await privateDirectory(root);
    const c = {
      extensionId,
      port: 47831,
      token: randomBytes(32).toString("hex"),
    };
    await writeFile(
      path.join(root, "connector.json"),
      JSON.stringify(c, null, 2),
      { flag: "wx", mode: 0o600 },
    );
    console.log(
      `Created private connector configuration in ${root}. Open connector.json locally to copy token into the extension. Never paste it into chat or logs.`,
    );
    return;
  }
  if (command === "serve") {
    const c = await config(),
      root = dataRoot(),
      lock = path.join(root, "runtime.lock");
    const handle = await open(lock, "wx", 0o600).catch(() => {
      throw Error(
        "runtime-lock-exists; stop the previous runtime; if crashed, verify its PID before removing runtime.lock",
      );
    });
    await handle.writeFile(String(process.pid));
    await handle.close();
    let server;
    const cleanup = async () => {
      await unlink(lock).catch(() => {});
    };
    try {
      const store = new StateStore(root);
      await store.init();
      const runtime = new Runtime(store);
      server = createServer(runtime, c);
      server.on("error", async (e) => {
        console.error(e.message);
        await cleanup();
        process.exitCode = 1;
      });
      server.listen(c.port, "127.0.0.1", () =>
        console.error(
          `SWU 0.1.0 listening on 127.0.0.1:${c.port}; no browser bound yet.`,
        ),
      );
      for (const signal of ["SIGINT", "SIGTERM"])
        process.once(signal, () => {
          runtime.disconnect("runtime-stopped");
          server.close(async () => {
            await cleanup();
            process.exit(0);
          });
        });
    } catch (e) {
      await cleanup();
      throw e;
    }
    return;
  }
  if (command === "mcp") {
    serveMCP();
    return;
  }
  if (command === "call") {
    const [method, file] = args;
    const input = file ? JSON.parse(await readFile(file, "utf8")) : {};
    console.log(JSON.stringify(await call(method, input), null, 2));
    return;
  }
  if (command === "status" || command === "observe" || command === "packs") {
    console.log(JSON.stringify(await call(command), null, 2));
    return;
  }
  console.log(
    "SWU 0.1.0\n  swu init EXTENSION_ID\n  swu serve\n  swu mcp\n  swu status | observe | packs\n  swu call METHOD [request.json]\nPrivate data: SWU_HOME or ~/.paw-swu. Browser input is synthetic.",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
