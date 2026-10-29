import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "./helpers.js";
test("popup container reading pins active revisions, captures fields before awaits and exposes progress/cancel", async (t) => {
  const saved = {
    document: globalThis.document,
    chrome: globalThis.chrome,
    Option: globalThis.Option,
  };
  t.after(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
  });
  const controls = new Map(),
    gets = [],
    runs = [],
    others = [];
  const control = (id) => {
    if (!controls.has(id))
      controls.set(id, {
        value: "",
        listeners: new Map(),
        addEventListener(k, f) {
          this.listeners.set(k, f);
        },
      });
    return controls.get(id);
  };
  globalThis.document = { getElementById: control, querySelectorAll: () => [] };
  globalThis.Option = class {};
  globalThis.chrome = {
    runtime: {
      sendMessage: async (m) => {
        if (m.type === "status")
          return { result: { extensionId: "test", connected: true } };
        if (m.method === "packGet")
          return { result: await new Promise((r) => gets.push(r)) };
        if (m.method === "pageRead") {
          runs.push(m.args);
          return {
            result: { operationId: m.args.operationId, reason: "fixture" },
          };
        }
        others.push(m);
        return { result: { fixture: true } };
      },
    },
  };
  await import("../extension/popup.js?page-reading-ui");
  const click = (id) => control(id).listeners.get("click")();
  const values = {
    pageReadPack: "site",
    pageReadRole: "container",
    pageReadRoles: "title, link",
    readKinds: "text,link",
    pageReadSteps: "2",
    pageReadMs: "10000",
    pageReadBytes: "65536",
    pageReadDy: "300",
  };
  for (const [k, v] of Object.entries(values)) control(k).value = v;
  let task = click("pageReadRun");
  await waitFor(() => gets.length === 1);
  control("pageReadDy").value = "301";
  gets.shift()({
    active: "a".repeat(64),
    activeEffectiveRevision: "b".repeat(64),
  });
  await task;
  assert.equal(runs.length, 0);
  assert.match(control("status").textContent, /fields changed/);
  task = click("pageReadRun");
  await waitFor(() => gets.length === 1);
  gets.shift()({
    active: "a".repeat(64),
    activeEffectiveRevision: "b".repeat(64),
  });
  await task;
  const args = structuredClone(runs[0]);
  assert.equal(args.packRevision, "a".repeat(64));
  assert.equal(args.effectiveRevision, "b".repeat(64));
  assert.deepEqual(args.read, {
    roles: ["title", "link"],
    kinds: ["text", "link"],
  });
  assert.equal(args.dy, 301);
  await click("pageReadRun");
  assert.deepEqual(runs[1], args);
  assert.equal(gets.length, 0);
  await click("pageReadProgress");
  await click("pageReadCancel");
  assert.equal(others.at(-2).method, "operation");
  assert.equal(others.at(-1).method, "cancel");
  assert.equal(others.at(-1).args.operationId, args.operationId);
});
