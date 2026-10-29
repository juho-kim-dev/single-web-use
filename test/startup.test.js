import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import path from "node:path";
import { ensureRuntime, runtimeLaunch, openChrome } from "../src/startup.js";
const configuration = {
  port: 47831,
  token: "a".repeat(64),
  extensionId: "b".repeat(32),
};
function fake(overrides = {}) {
  let now = 0;
  return {
    config: async () => configuration,
    probe: async () => {
      throw Error("offline");
    },
    locked: async () => false,
    launch: () => new EventEmitter(),
    now: () => now,
    wait: async (ms) => {
      now += ms;
    },
    ...overrides,
  };
}
test("startup reuses ready runtime without launching, and missing configuration requires setup", async () => {
  let launches = 0;
  const io = fake({
    probe: async () => ({
      version: "0.6.0",
      bindProtocol: "guarded-auto-v1",
      connected: false,
    }),
    launch: () => {
      launches++;
    },
  });
  assert.equal((await ensureRuntime({}, io)).connected, false);
  assert.equal(launches, 0);
  await assert.rejects(
    ensureRuntime(
      {},
      fake({
        config: async () => {
          throw Object.assign(Error("private-path"), { code: "ENOENT" });
        },
        launch: () => {
          assert.fail("no launch");
        },
      }),
    ),
    /^Error: setup-required$/,
  );
  await assert.rejects(
    ensureRuntime({}, fake({ config: async () => null })),
    /setup-required/,
  );
});
test("concurrent startup contenders reuse the exclusive serve lock and bounded readiness", async () => {
  let owner = 0,
    launches = 0,
    now = 0;
  const io = fake({
    now: () => now,
    wait: async (ms) => {
      now += ms;
    },
    locked: async () => owner > 0,
    launch: () => {
      launches++;
      if (!owner) owner++;
      return new EventEmitter();
    },
    probe: async () =>
      now >= 200
        ? {
            version: "0.6.0",
            bindProtocol: "guarded-auto-v1",
            connected: false,
          }
        : null,
  });
  const results = await Promise.all([
    ensureRuntime({ timeoutMs: 1000 }, io),
    ensureRuntime({ timeoutMs: 1000 }, io),
  ]);
  assert.equal(owner, 1);
  assert.ok(launches >= 1 && launches <= 2);
  assert.equal(results.length, 2);
});
test("startup preserves nonready locks and reports bounded timeout or spawn failure without retry", async () => {
  let launches = 0;
  await assert.rejects(
    ensureRuntime(
      { timeoutMs: 200 },
      fake({
        locked: async () => true,
        launch: () => {
          launches++;
        },
      }),
    ),
    /runtime-owner-not-ready/,
  );
  assert.equal(launches, 0);
  await assert.rejects(
    ensureRuntime({ timeoutMs: 200 }, fake()),
    /readiness-timeout/,
  );
  const child = new EventEmitter();
  await assert.rejects(
    ensureRuntime(
      { timeoutMs: 200 },
      fake({
        launch: () => {
          queueMicrotask(() => child.emit("error", Error("private-path")));
          return child;
        },
      }),
    ),
    /runtime-start-failed/,
  );
});
test("runtime and explicit browser launch use absolute argv, no shell/profile/credential arguments", async () => {
  const p = runtimeLaunch();
  assert.ok(path.isAbsolute(p.executable));
  assert.ok(path.isAbsolute(p.args[0]));
  assert.equal(p.args[1], "serve");
  assert.equal(p.options.shell, false);
  assert.equal(p.options.windowsHide, true);
  assert.equal(p.options.detached, true);
  assert.equal(p.options.stdio, "ignore");
  const old = process.env.ProgramFiles;
  process.env.ProgramFiles = "C:/Program Files & SWU";
  try {
    let seen;
    await openChrome({
      platform: "win32",
      exists: async () => true,
      spawn: (exe, args, options) => {
        seen = { exe, args, options };
        const child = new EventEmitter();
        child.unref = () => {};
        queueMicrotask(() => child.emit("spawn"));
        return child;
      },
    });
    assert.ok(path.isAbsolute(seen.exe));
    assert.deepEqual(seen.args, ["https://www.google.com/"]);
    assert.equal(seen.options.shell, false);
    assert.equal(seen.options.windowsHide, false);
  } finally {
    if (old === undefined) delete process.env.ProgramFiles;
    else process.env.ProgramFiles = old;
  }
});

test("fractional readiness clock always produces a positive integer AbortSignal timeout", async () => {
  let now = 0.25,
    probes = 0;
  const io = fake({
    now: () => {
      now += 0.1;
      return now;
    },
    wait: async (ms) => {
      now += ms;
    },
    probe: async (timeout) => {
      assert.ok(Number.isInteger(timeout) && timeout > 0);
      assert.doesNotThrow(() => AbortSignal.timeout(timeout));
      return ++probes > 1
        ? {
            version: "0.6.0",
            bindProtocol: "guarded-auto-v1",
            connected: false,
          }
        : null;
    },
  });
  assert.equal((await ensureRuntime({ timeoutMs: 250 }, io)).version, "0.6.0");
  assert.ok(probes >= 2);
});
test("incompatible running runtime requires explicit update/restart without launching or altering lock/config", async () => {
  let launches = 0,
    locks = 0;
  const before = structuredClone(configuration);
  await assert.rejects(
    ensureRuntime(
      {},
      fake({
        probe: async () => ({ version: "0.5.0", connected: false }),
        locked: async () => {
          locks++;
          return true;
        },
        launch: () => {
          launches++;
        },
      }),
    ),
    /runtime-update-restart-required/,
  );
  assert.equal(launches, 0);
  assert.equal(locks, 0);
  assert.deepEqual(configuration, before);
});
