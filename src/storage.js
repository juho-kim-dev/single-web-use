import { mkdir, readFile, rename, lstat, open, unlink } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { id } from "./contracts.js";
export const hash = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
export async function privateDirectory(root) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  if ((await lstat(root)).isSymbolicLink())
    throw Error("private-directory-symlink");
}
export async function readJSON(file) {
  if ((await lstat(file)).isSymbolicLink()) throw Error("state-symlink");
  return JSON.parse(await readFile(file, "utf8"));
}
export async function atomicJSON(file, value, beforeReplace = async () => {}) {
  const tmp = `${file}.${randomUUID()}.tmp`;
  const handle = await open(tmp, "wx", 0o600);
  try {
    try {
      await handle.writeFile(JSON.stringify(value, null, 2));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await beforeReplace();
    await rename(tmp, file);
  } finally {
    await unlink(tmp).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
  }
}
export class StateStore {
  constructor(root) {
    this.root = root;
    this.file = path.join(root, "state.json");
    this.data = { packs: {}, operations: {} };
    this.digest = null;
    this.queue = Promise.resolve();
  }
  async init() {
    await privateDirectory(this.root);
    try {
      this.data = await readJSON(this.file);
      this.digest = hash(this.data);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    if (!this.data.packs || !this.data.operations) throw Error("invalid-state");
    for (const key of [
      ...Object.keys(this.data.packs),
      ...Object.keys(this.data.operations),
    ])
      id.parse(key);
    for (const op of Object.values(this.data.operations))
      if (op.receipt.delivery === "pending")
        op.receipt = {
          accepted: true,
          delivery: "unknown",
          outcome: "unknown",
          reason: "runtime-restarted-no-retry",
        };
    // Recovery is persisted by the next mutation; the on-disk digest stays unchanged.
  }
  async change(fn) {
    const run = this.queue.then(async () => {
      const assertUnchanged = async () => {
        let disk = null;
        try {
          disk = hash(await readJSON(this.file));
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
        }
        if (disk !== this.digest)
          throw Error("state-externally-edited-restart-required");
      };
      await assertUnchanged();
      const next = structuredClone(this.data);
      const result = await fn(next);
      // shortcut: digest check + rename is not atomic CAS; require a single runtime and no external editors.
      await atomicJSON(this.file, next, assertUnchanged);
      this.data = next;
      this.digest = hash(next);
      return structuredClone(result);
    });
    this.queue = run.catch(() => {});
    return run;
  }
}
