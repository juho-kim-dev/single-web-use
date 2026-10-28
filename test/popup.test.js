import test from "node:test";
import assert from "node:assert/strict";
import { waitFor } from "./helpers.js";

test("actual popup document handlers reject stale selection responses and capture append intent before awaits", async (t) => {
  let nextAppendError = null;
  let localStorage = { token: "a".repeat(64) },
    listener;
  const saved = {
      document: globalThis.document,
      chrome: globalThis.chrome,
      Option: globalThis.Option,
      fetch: globalThis.fetch,
    },
    controls = new Map(),
    reads = [],
    appends = [];
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  const control = (id) => {
    if (!controls.has(id))
      controls.set(id, {
        value: "",
        disabled: false,
        listeners: new Map(),
        addEventListener(type, fn) {
          this.listeners.set(type, fn);
        },
        replaceChildren() {},
        add() {},
        setAttribute() {},
      });
    return controls.get(id);
  };
  globalThis.document = { getElementById: control, querySelectorAll: () => [] };
  globalThis.Option = class {};
  const event = { addListener() {} };
  globalThis.chrome = {
    tabs: { onActivated: event, onRemoved: event, onUpdated: event },
    windows: { onFocusChanged: event },
    storage: {
      session: { get: async () => ({}) },
      local: {
        get: async () => structuredClone(localStorage),
        set: async (value) => {
          localStorage = structuredClone({ ...localStorage, ...value });
        },
      },
    },
    runtime: {
      id: "test",
      getURL: (path) => "chrome-extension://test/" + path,
      onMessage: {
        addListener: (fn) => {
          listener = fn;
        },
      },
      sendMessage: (message) =>
        new Promise((resolve) =>
          listener(
            message,
            { id: "test", url: "chrome-extension://test/popup.html" },
            resolve,
          ),
        ),
    },
  };
  globalThis.fetch = async (url, options) => ({
    json: async () => {
      const message = JSON.parse(options.body);
      if (message.method === "documentRead")
        return {
          result: await new Promise((resolve) =>
            reads.push({ id: message.args.id, resolve }),
          ),
        };
      if (message.method === "documentAppend") {
        appends.push(message.args);
        if (nextAppendError) {
          const error = nextAppendError;
          nextAppendError = null;
          return { error };
        }
        return {
          result: {
            id: message.args.id,
            revision: "c".repeat(64),
            sections: 2,
          },
        };
      }
      throw Error("Unexpected UI call " + message.method);
    },
  });
  await import("../extension/worker.js?document-ui");
  await import("../extension/popup.js?selection-regression");
  const click = (id) => control(id).listeners.get("click")();
  const select = (id) => {
    control("documentSelect").value = id;
    control("documentSelect").listeners.get("change")();
  };
  select("A");
  control("savedId").value = "content-A";
  const oldRead = click("documentRead");
  await waitFor(() => reads.length === 1);
  select("B");
  control("savedId").value = "content-B";
  const append = click("documentAppend");
  await waitFor(() => reads.length === 2);
  reads[1].resolve({ id: "B", revision: "b".repeat(64) });
  reads[0].resolve({ id: "A", revision: "a".repeat(64) });
  await oldRead;
  await append;
  assert.equal(appends.length, 1);
  assert.equal(appends[0].id, "B");
  assert.equal(appends[0].contentId, "content-B");
  select("A");
  const staleAppend = click("documentAppend");
  await waitFor(() => reads.length === 3);
  select("B");
  reads[2].resolve({ id: "A", revision: "a".repeat(64) });
  await staleAppend;
  assert.equal(appends.length, 1);
  control("savedId").value = "clicked-content";
  const captured = click("documentAppend");
  await waitFor(() => reads.length === 4);
  control("savedId").value = "later-content";
  reads[3].resolve({ id: "B", revision: "b".repeat(64) });
  await captured;
  assert.equal(appends[1].id, "B");
  assert.equal(appends[1].contentId, "clicked-content");
  select("B");
  control("savedId").value = "conflicting-content";
  let load = click("documentRead");
  await waitFor(() => reads.length === 5);
  reads[4].resolve({ id: "B", revision: "b".repeat(64) });
  await load;
  nextAppendError = "reading-document-revision-conflict";
  await click("documentAppend");
  const rejected = appends.at(-1);
  load = click("documentRead");
  await waitFor(() => reads.length === 6);
  reads[5].resolve({ id: "B", revision: "d".repeat(64) });
  await load;
  await click("documentAppend");
  assert.equal(appends.at(-1).expected, "d".repeat(64));
  assert.notEqual(appends.at(-1).appendId, rejected.appendId);
  control("savedId").value = "uncertain-content";
  nextAppendError = "connection-lost";
  const uncertain = click("documentAppend");
  await waitFor(() => reads.length === 7);
  reads[6].resolve({ id: "B", revision: "c".repeat(64) });
  await uncertain;
  const uncertainRequest = { ...appends.at(-1) };
  load = click("documentRead");
  await waitFor(() => reads.length === 8);
  reads[7].resolve({ id: "B", revision: "e".repeat(64) });
  await load;
  await click("documentAppend");
  assert.deepEqual(appends.at(-1), uncertainRequest);
  const beforeConcurrent = appends.length;
  nextAppendError = "connection-lost";
  await Promise.all([
    chrome.runtime.sendMessage({
      type: "documentAppend",
      args: { id: "C", contentId: "same", expected: "f".repeat(64) },
    }),
    chrome.runtime.sendMessage({
      type: "documentAppend",
      args: { id: "D", contentId: "other", expected: "f".repeat(64) },
    }),
    chrome.runtime.sendMessage({
      type: "documentAppend",
      args: { id: "C", contentId: "same", expected: "a".repeat(64) },
    }),
  ]);
  assert.deepEqual(appends[beforeConcurrent], appends[beforeConcurrent + 2]);
  assert.ok(localStorage.documentAppendRequests[JSON.stringify(["C", "same"])]);
  assert.ok(
    localStorage.documentAppendRequests[JSON.stringify(["D", "other"])],
  );
  select("A");
  control("savedId").value = "different-content";
  let other = click("documentAppend");
  await waitFor(() => reads.length === 9);
  reads[8].resolve({ id: "A", revision: "a".repeat(64) });
  await other;
  select("B");
  control("savedId").value = "uncertain-content";
  nextAppendError = "connection-lost";
  other = click("documentAppend");
  await waitFor(() => reads.length === 10);
  reads[9].resolve({ id: "B", revision: "e".repeat(64) });
  await other;
  assert.deepEqual(appends.at(-1), uncertainRequest);
  await import("../extension/worker.js?worker-restarted");
  await import("../extension/popup.js?popup-reopened");
  select("B");
  other = click("documentAppend");
  await waitFor(() => reads.length === 11);
  reads[10].resolve({ id: "B", revision: "e".repeat(64) });
  await other;
  assert.deepEqual(appends.at(-1), uncertainRequest);
});
