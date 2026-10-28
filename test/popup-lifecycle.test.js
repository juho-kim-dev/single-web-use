import test from "node:test";
import assert from "node:assert/strict";
import { pack, waitFor } from "./helpers.js";

test("lifecycle and load replies preserve JSON, ordinary field and selection edits made during awaits", async (t) => {
  const saved = {
    document: globalThis.document,
    chrome: globalThis.chrome,
    Option: globalThis.Option,
  };
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  const controls = new Map(),
    gets = [],
    archives = [];
  const control = (id) => {
    if (!controls.has(id))
      controls.set(id, {
        value: "",
        listeners: new Map(),
        addEventListener(type, fn) {
          this.listeners.set(type, fn);
        },
        replaceChildren() {},
        add() {},
      });
    return controls.get(id);
  };
  globalThis.document = { getElementById: control, querySelectorAll: () => [] };
  globalThis.Option = class {};
  globalThis.chrome = {
    runtime: {
      sendMessage: async (message) => {
        if (message.type === "status")
          return { result: { extensionId: "test", connected: false } };
        if (message.method === "packGet")
          return { result: await new Promise((resolve) => gets.push(resolve)) };
        if (message.method === "packArchive")
          return {
            result: await new Promise((resolve) => archives.push(resolve)),
          };
        throw Error("Unexpected call " + message.method);
      },
    },
  };
  await import("../extension/popup.js?lifecycle-race");
  const click = (id) => control(id).listeners.get("click")();
  const definition = pack(),
    revision = "a".repeat(64);
  const stored = {
    draft: revision,
    active: null,
    revisions: { [revision]: definition },
    tests: {},
  };
  for (const [field, changedValue] of [
    ["editor", JSON.stringify({ ...definition, name: "Unsaved JSON" })],
    ["authorName", "Unsaved ordinary field"],
  ]) {
    control("packList").value = definition.id;
    let loading = click("load");
    await waitFor(() => gets.length);
    gets.shift()(stored);
    await loading;
    const archiving = click("archivePack");
    await waitFor(() => archives.length);
    control(field).value = changedValue;
    control(field).listeners.get("input")?.();
    archives.shift()({ id: definition.id, archived: true });
    await archiving;
    assert.equal(control(field).value, changedValue);
    assert.equal(gets.length, 0);
    assert.match(control("packResult").textContent, /editorPreserved/);
  }
  let loading = click("load");
  await waitFor(() => gets.length);
  control("editor").value = "newer draft while loading";
  gets.shift()(stored);
  await loading;
  assert.equal(control("editor").value, "newer draft while loading");
  assert.match(control("status").textContent, /Editor changed/);
  loading = click("load");
  await waitFor(() => gets.length);
  control("packList").value = "other-pack";
  gets.shift()(stored);
  await loading;
  assert.equal(control("packList").value, "other-pack");
  assert.equal(control("editor").value, "newer draft while loading");
});
