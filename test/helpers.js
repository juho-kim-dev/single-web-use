import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { StateStore } from "../src/storage.js";
import { Runtime } from "../src/runtime.js";
import { setTimeout as pause } from "node:timers/promises";
const realPause = pause;
export function observation(overrides = {}) {
  return {
    id: randomUUID(),
    surfaceId: "1",
    session: randomUUID(),
    documentId: "doc-1",
    generation: 0,
    revision: 0,
    url: "https://example.com/",
    at: Date.now() + 1,
    viewport: { width: 800, height: 600, x: 0, y: 0, scale: 1, dpr: 1 },
    nodes: [
      {
        ref: "n1",
        tag: "input",
        role: "textbox",
        label: "Search",
        labelSource: "aria-label",
        text: "",
        textEvidence: {
          method: "range-fully-inside-viewport-and-overflow-clips",
          truncated: false,
          omitted: false,
          pixels: "unverified",
        },
        href: null,
        value: "",
        disabled: false,
        editable: true,
        rect: { x: 20, y: 20, width: 200, height: 30 },
        exposure: "hit-tested",
        locator: { selector: "#search" },
        matches: ["#search"],
        parent: null,
        states: {},
      },
    ],
    coverage: { visited: 1, truncated: false, limitations: [] },
    evidence: "dom-and-hit-test-not-pixels",
    userEpoch: 0,
    ...overrides,
  };
}
export function pack(overrides = {}) {
  return {
    format: "paw-swu-pack",
    schemaVersion: 1,
    id: "search",
    version: "0.1.0",
    name: "Search field",
    scope: { origin: "https://example.com", pathPrefix: "/", conditions: [] },
    roles: [
      { id: "search", locator: { selector: "#search" }, extract: "text" },
    ],
    permissions: ["read", "fill"],
    procedures: [
      {
        id: "query",
        preconditions: [{ role: "search", state: "enabled" }],
        postconditions: [{ role: "search", state: "value", equals: "SWU" }],
        steps: [{ kind: "fill", role: "search", text: "SWU" }],
      },
    ],
    ...overrides,
  };
}
export async function fixture(t, timeout = 5000) {
  const root = await mkdtemp(path.join(os.tmpdir(), "paw-swu-test-"));
  const store = new StateStore(root);
  await store.init();
  const runtime = new Runtime(store, timeout);
  const tasks = new Set(),
    call = runtime.call.bind(runtime),
    command = runtime.command.bind(runtime);
  let closing = false;
  runtime.call = (...args) => {
    const task = call(...args);
    tasks.add(task);
    task.then(
      () => tasks.delete(task),
      () => tasks.delete(task),
    );
    return task;
  };
  runtime.command = (...args) => {
    if (closing) throw Error("fixture-closing");
    return command(...args);
  };
  let cleaning;
  const cleanup = () =>
    (cleaning ??= (async () => {
      closing = true;
      runtime.disconnect("fixture-teardown");
      await Promise.allSettled([...tasks]);
      await runtime.queue;
      await store.queue;
      await rm(root, { recursive: true, force: true });
    })());
  t.after(cleanup);
  const { session } = runtime.bind({ tabId: 1, windowId: 2 });
  return { root, store, runtime, session, cleanup };
}
export const tick = () => new Promise((r) => setTimeout(r, 0));
export async function waitFor(
  predicate,
  description = "expected-pending-command",
) {
  const deadline = performance.now() + 5000;
  while (!predicate()) {
    if (performance.now() >= deadline) throw Error(description);
    await realPause(5);
  }
}
export async function pending(runtime) {
  await waitFor(() => runtime.pending && !runtime.pending.leased);
  return runtime.poll(runtime.session).command;
}
export const action = (o) => ({
  operationId: "operation-1",
  observationId: o.id,
  target: "n1",
  kind: "fill",
  text: "SWU",
  expectedValue: "",
  intent: "edit-field",
});
