import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config, call, dataRoot } from "./client.js";
const cli = fileURLToPath(new URL("./cli.js", import.meta.url));
export function runtimeLaunch() {
  return {
    executable: process.execPath,
    args: [cli, "serve"],
    options: {
      cwd: path.dirname(cli),
      detached: true,
      windowsHide: true,
      stdio: "ignore",
      shell: false,
    },
  };
}
const defaults = {
  config,
  probe: (timeout) => call("status", {}, { timeout }),
  locked: async () => {
    try {
      await access(path.join(dataRoot(), "runtime.lock"));
      return true;
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      return false;
    }
  },
  launch: () => {
    const p = runtimeLaunch();
    const child = spawn(p.executable, p.args, p.options);
    child.unref();
    return child;
  },
  now: () => performance.now(),
  wait: (ms) => new Promise((r) => setTimeout(r, ms)),
};
export async function ensureRuntime(
  { timeoutMs = 10000 } = {},
  overrides = {},
) {
  const io = { ...defaults, ...overrides };
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000)
    throw Error("invalid-start-timeout");
  let c;
  try {
    c = await io.config();
  } catch (e) {
    throw Error(
      e.code === "ENOENT" ? "setup-required" : "connector-config-unavailable",
    );
  }
  if (
    !c ||
    !Number.isInteger(c.port) ||
    c.port < 1024 ||
    c.port > 65535 ||
    !/^[a-f0-9]{64}$/.test(c.token ?? "") ||
    !/^[a-p]{32}$/.test(c.extensionId ?? "")
  )
    throw Error("setup-required");
  const deadline = io.now() + timeoutMs;
  const probe = async () => {
    let s;
    try {
      s = await io.probe(
        Math.max(1, Math.floor(Math.min(500, deadline - io.now()))),
      );
    } catch {
      return null;
    }
    if (!s || typeof s.version !== "string" || typeof s.connected !== "boolean")
      return null;
    if (s.bindProtocol !== "guarded-auto-v1")
      throw Error("runtime-update-restart-required");
    return s;
  };
  let status = await probe();
  if (status) return status;
  const locked = await io.locked();
  let failed = false;
  if (!locked) {
    try {
      io.launch().on("error", () => {
        failed = true;
      });
    } catch {
      throw Error("runtime-start-failed");
    }
  }
  while (io.now() < deadline) {
    if (failed) throw Error("runtime-start-failed");
    await io.wait(Math.min(100, Math.max(0, deadline - io.now())));
    if (io.now() >= deadline) break;
    status = await probe();
    if (status) return status;
  }
  throw Error(
    locked
      ? "runtime-owner-not-ready; inspect-runtime-lock-explicitly"
      : "runtime-readiness-timeout; inspect-runtime-lock-explicitly",
  );
}
export async function openChrome(overrides = {}) {
  const platform = overrides.platform ?? process.platform,
    exists =
      overrides.exists ??
      (async (p) => {
        try {
          await access(p);
          return true;
        } catch {
          return false;
        }
      }),
    launch = overrides.spawn ?? spawn;
  if (platform !== "win32")
    throw Error("browser-launch-windows-only; open-Google-home-manually");
  const candidates = [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    process.env.LOCALAPPDATA,
  ]
    .filter(Boolean)
    .map((root) => path.resolve(root, "Google/Chrome/Application/chrome.exe"));
  for (const executable of candidates)
    if (await exists(executable)) {
      await new Promise((resolve, reject) => {
        const child = launch(executable, ["https://www.google.com/"], {
          detached: true,
          windowsHide: false,
          stdio: "ignore",
          shell: false,
        });
        child.once("error", () => reject(Error("chrome-launch-failed")));
        child.once("spawn", () => {
          child.unref();
          resolve();
        });
      });
      return { opened: true };
    }
  throw Error("chrome-not-found; open-Google-home-manually");
}
