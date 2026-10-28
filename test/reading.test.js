import test from "node:test";
import assert from "node:assert/strict";
import { fixture, observation, pack, pending } from "./helpers.js";
import { StateStore } from "../src/storage.js";
import { Runtime } from "../src/runtime.js";
import { composeText } from "../src/reading.js";
import { packSchema } from "../src/contracts.js";
import { editDefinition } from "../extension/editor.js";
import { hash } from "../src/storage.js";

test("export preserves the original stored definition and digest when new optional defaults are interpreted internally", async (t) => {
  const { runtime, store } = await fixture(t),
    original = pack();
  // Match the schema field order used by the stored 0.1.0 definition format.
  original.procedures = original.procedures.map(
    ({ id, preconditions, postconditions, steps }) => ({
      id,
      parameters: [],
      preconditions,
      postconditions,
      steps,
    }),
  );
  const revision = hash(original);
  await store.change((s) => {
    s.packs[original.id] = {
      draft: revision,
      active: null,
      revisions: { [revision]: original },
      created: { [revision]: 1 },
      tests: {},
      installed: [revision],
    };
  });
  assert.equal(
    runtime.packs.definition(original.id, revision).roles[0].cardinality,
    undefined,
  );
  const exported = await runtime.call("packExport", {
    id: original.id,
    revision,
  });
  assert.deepEqual(exported, original);
  assert.equal(hash(exported), revision);
  assert.equal(
    (await runtime.call("packImport", { pack: exported, expected: revision }))
      .revision,
    revision,
  );
});

function cards(session) {
  const o = observation({ session }),
    base = o.nodes[0];
  o.nodes = [
    {
      ...base,
      ref: "a1",
      tag: "a",
      text: "",
      textSegments: [],
      href: "https://example.com/one",
      editable: false,
      value: null,
      locator: { selector: "#one" },
      matches: [".cards"],
      label: "METADATA",
    },
    {
      ...base,
      ref: "t1",
      tag: "span",
      text: "Title One",
      textSegments: [{ order: 1, text: "Title One" }],
      href: null,
      parent: "a1",
      locator: { selector: "#one span" },
      matches: [],
      label: "",
    },
    {
      ...base,
      ref: "a2",
      tag: "a",
      text: "",
      textSegments: [],
      href: "https://example.com/two",
      editable: false,
      value: null,
      locator: { selector: "#two" },
      matches: [".cards"],
      label: "OTHER_METADATA",
    },
    {
      ...base,
      ref: "t2",
      tag: "span",
      text: "Title Two",
      textSegments: [{ order: 2, text: "Title Two" }],
      href: null,
      parent: "a2",
      locator: { selector: "#two span" },
      matches: [],
      label: "",
    },
  ];
  return o;
}
const listPack = () =>
  pack({
    roles: [
      {
        id: "cards",
        locator: { selector: ".cards" },
        extract: "link",
        cardinality: "many",
        limit: 10,
      },
    ],
    permissions: ["read"],
    procedures: [],
  });
async function activate(runtime, session, p, o, ack = []) {
  const r = await runtime.packs.draft(p, null);
  o.at = Date.now() + 5;
  await runtime.packs.recordTest(p.id, r.revision, o);
  await runtime.packs.activate(p.id, r.revision, session, ack);
  return r;
}
test("many roles extract same-item descendant title/link, paginate immutable observation, modes and unknown/truncation are explicit", async (t) => {
  const { runtime, session } = await fixture(t),
    o = cards(session);
  await activate(runtime, session, listPack(), o);
  runtime.retain(o);
  const first = await runtime.call("read", {
    observationId: o.id,
    packId: "search",
    limit: 1,
  });
  assert.equal(first.items[0].value.text, "Title One");
  assert.equal(first.items[0].value.href, "https://example.com/one");
  assert.equal(first.items[0].metadata.label, "METADATA");
  assert.deepEqual(
    first.items[0].value.reading.sources.map((n) => n.ref),
    ["a1", "t1"],
  );
  const next = await runtime.call(
    first.continuation.method,
    first.continuation.args,
  );
  assert.equal(next.observationId, o.id);
  assert.equal(next.items[0].value.text, "Title Two");
  assert.equal(next.items[0].value.href, "https://example.com/two");
  assert.equal(next.continuation, null);
  assert.equal(runtime.pending, null);
  assert.deepEqual(await runtime.call("read", first.continuation.args), next);
  const textOnly = await runtime.call("read", {
    observationId: o.id,
    kinds: ["text"],
    within: "a1",
  });
  assert.ok(
    textOnly.items.every((i) => i.mode === "text" && !("href" in i.value)),
  );
  assert.ok(textOnly.items.every((i) => ["a1", "t1"].includes(i.ref)));
  const truncated = cards(session);
  truncated.coverage.truncated = true;
  runtime.retain(truncated);
  assert.equal(
    (
      await runtime.call("read", {
        observationId: truncated.id,
        packId: "search",
      })
    ).roles[0].truncated,
    true,
  );
  const absent = cards(session);
  absent.nodes = [];
  runtime.retain(absent);
  const missing = await runtime.call("read", {
    observationId: absent.id,
    packId: "search",
  });
  assert.equal(missing.roles[0].status, "not-observed");
  assert.equal(missing.items.length, 0);
  const context = runtime.packs.context(o);
  assert.equal(
    (
      await runtime.call(
        "read",
        context.matches[0].extraction[0].continuation.args,
      )
    ).items[1].value.text,
    "Title Two",
  );
});
test("composed text preserves segment order, parent evidence, per-item byte refusal and single-role ambiguity", async (t) => {
  const { runtime, session } = await fixture(t),
    o = cards(session);
  o.nodes[0].text = "before after";
  o.nodes[0].textSegments = [
    { order: 0, text: "before" },
    { order: 3, text: "after" },
  ];
  assert.equal(composeText(o, o.nodes[0]).text, "before Title One after");
  const p = listPack();
  p.roles[0].cardinality = "one";
  await activate(runtime, session, p, { ...o, nodes: o.nodes.slice(0, 2) });
  runtime.retain(o);
  const result = await runtime.call("read", {
    observationId: o.id,
    packId: p.id,
  });
  assert.equal(result.roles[0].status, "ambiguous");
  assert.equal(result.items.length, 0);
  o.nodes[1].textSegments = [{ order: 1, text: "x".repeat(4000) }];
  o.nodes[1].text = "x".repeat(4000);
  const big = runtime.retain({ ...o, id: "large-reading" });
  const blocked = await runtime.call("read", {
    observationId: big.id,
    kinds: ["text"],
    maxBytes: 1024,
  });
  assert.equal(blocked.page.blocked, "item-exceeds-byte-budget");
  assert.equal(blocked.page.nextOffset, 0);
});
test("retained history/read/diff are immutable, no longer observed is not deletion, cross-document/session diffs rejected", async (t) => {
  const { runtime, session } = await fixture(t),
    one = runtime.retain(cards(session)),
    two = cards(session);
  two.nodes = two.nodes.slice(0, 2);
  two.nodes[1].text = "Changed";
  two.nodes[1].textSegments = [{ order: 1, text: "Changed" }];
  runtime.retain(two);
  const diff = await runtime.call("observationDiff", {
    before: one.id,
    after: two.id,
  });
  assert.ok(diff.changed.some((c) => c.ref === "t1"));
  assert.deepEqual(diff.noLongerObserved, ["a2", "t2"]);
  assert.equal(diff.inputPermission, false);
  const copy = await runtime.call("observationRead", { observationId: one.id });
  copy.observation.nodes[0].href = "tampered";
  assert.equal(
    runtime.retained(one.id).nodes[0].href,
    "https://example.com/one",
  );
  const other = runtime.retain(cards(session));
  other.documentId = "other";
  runtime.observations.set(other.id, other);
  await assert.rejects(
    runtime.call("observationDiff", { before: one.id, after: other.id }),
    /incompatible/,
  );
  runtime.bind({ tabId: 1, windowId: 2 });
  assert.equal(
    (await runtime.call("observationHistory", {})).observations.length,
    3,
  );
  assert.equal(
    (await runtime.call("observationRead", { observationId: one.id }))
      .inputPermission,
    false,
  );
  assert.throws(() => runtime.observed(one.id), /expired/);
});
test("explicit private content survives restart, preserves exact page provenance and never enters pack export/input state", async (t) => {
  const { runtime, session, root } = await fixture(t),
    o = cards(session),
    p = listPack();
  const revision = await activate(runtime, session, p, o);
  runtime.retain(o);
  const read = await runtime.call("read", {
    observationId: o.id,
    packId: p.id,
    limit: 1,
  });
  const saved = await runtime.call("contentSave", {
    observationId: o.id,
    name: "Private selection",
    read: read.filter,
  });
  const reopened = new StateStore(root);
  await reopened.init();
  const next = new Runtime(reopened);
  assert.equal((await next.call("contentList", {}))[0].id, saved.id);
  const restored = await next.call("contentRead", { id: saved.id });
  assert.deepEqual(restored.reading, read);
  assert.equal(restored.reading.provenance.url, o.url);
  assert.equal(restored.inputPermission, false);
  assert.equal(next.observations.size, 0);
  const exported = await next.call("packExport", {
    id: p.id,
    revision: revision.revision,
  });
  assert.ok(!JSON.stringify(exported).includes("Title One"));
  assert.equal("contents" in exported, false);
});
test("inactive unrelated draft selectors cannot poison ordinary observation; exact draft test supplies its selectors; deactivation preserves history", async (t) => {
  const { runtime, session } = await fixture(t, 500),
    p = listPack(),
    r = await runtime.packs.draft(p, null);
  const read = runtime.call("observe", {}),
    cmd = await pending(runtime);
  assert.deepEqual(cmd.args.selectors, []);
  runtime.reply(session, cmd.id, cards(session));
  await read;
  const probe = runtime.call("packTest", { id: p.id, revision: r.revision }),
    testCommand = await pending(runtime);
  assert.deepEqual(testCommand.args.selectors, [".cards"]);
  const o = cards(session);
  o.at = Date.now() + 5;
  runtime.reply(session, testCommand.id, o);
  assert.equal((await probe).pass, true);
  await runtime.call("packActivate", { id: p.id, revision: r.revision });
  await runtime.call("packDeactivate", { id: p.id, expected: r.revision });
  assert.equal(runtime.packs.get(p.id).active, null);
  assert.ok(runtime.packs.get(p.id).revisions[r.revision]);
});
test("global base narrows to site overlay; explicit new primitive permissions surface in preview/test and activation acknowledgement", async (t) => {
  const { runtime, session } = await fixture(t),
    base = pack({
      id: "library",
      scope: { origin: null, pathPrefix: "/", conditions: [] },
      permissions: ["read"],
      procedures: [],
    }),
    r = await runtime.packs.draft(base, null);
  const overlay = pack({
      id: "personal-query",
      extends: { id: base.id, revision: r.revision },
    }),
    own = await runtime.packs.draft(overlay, null);
  const o = observation({ session, at: Date.now() + 5 });
  const report = await runtime.packs.recordTest(overlay.id, own.revision, o);
  assert.deepEqual(report.addedPermissions, ["fill"]);
  assert.deepEqual(
    runtime.packs.preview(overlay.id, overlay).addedPermissions,
    ["fill"],
  );
  await assert.rejects(
    runtime.call("packActivate", { id: overlay.id, revision: own.revision }),
    /acknowledgement/,
  );
  await runtime.call("packActivate", {
    id: overlay.id,
    revision: own.revision,
    acknowledgePermissions: ["fill"],
  });
  assert.equal(
    runtime.packs.effective(overlay.id, own.revision).scope.origin,
    "https://example.com",
  );
  assert.deepEqual(runtime.packs.definition(base.id, r.revision).permissions, [
    "read",
  ]);
  const wrong = {
    ...overlay,
    id: "broad",
    extends: { id: overlay.id, revision: own.revision },
    scope: { origin: null, pathPrefix: "/", conditions: [] },
  };
  await assert.rejects(runtime.packs.draft(wrong, null));
  runtime.retain(o);
  const capabilities = await runtime.call("capabilities", {
    observationId: o.id,
    purpose: "act",
  });
  assert.equal(capabilities.primitives[0].input, "DOM-synthetic");
  assert.deepEqual(capabilities.procedures[0].parameters.required, []);
  assert.equal(capabilities.inputPermission, false);
  runtime.bind({ tabId: 1, windowId: 2 });
  assert.ok(
    (
      await runtime.call("capabilities", {
        observationId: o.id,
        purpose: "act",
      })
    ).procedures[0].blockedReasons.includes("observation-from-prior-binding"),
  );
});
test("ordinary author fields compose fill/scroll/navigation with parameters without mutating shared definition or activation", () => {
  const original = pack({ permissions: ["read"], procedures: [] }),
    fields = {
      id: "search",
      name: "My role",
      version: "0.2.0",
      origin: "https://example.com",
      pathPrefix: "/",
      role: "search",
      selector: "#search",
      extract: "state",
      cardinality: "one",
      limit: "50",
      kind: "fill",
      procedure: "query",
      parameter: "query",
      value: "",
    };
  const draft = editDefinition(original, fields);
  assert.equal(original.procedures.length, 0);
  assert.deepEqual(packSchema.parse(draft).procedures[0].parameters, ["query"]);
  assert.equal("active" in draft, false);
  const scroll = editDefinition(draft, {
    ...fields,
    kind: "scroll",
    value: "400",
    parameter: "",
  });
  assert.equal(scroll.procedures[0].steps.length, 2);
  const navigation = editDefinition(scroll, {
    ...fields,
    kind: "click",
    parameter: "linkUrl",
  });
  assert.equal(
    packSchema.parse(navigation).procedures[0].steps[2].linkParameter,
    "linkUrl",
  );
});

test("explicit saved-content count/byte limits fail without discarding existing content", async (t) => {
  const { runtime, session, store } = await fixture(t),
    o = runtime.retain(cards(session));
  await store.change((s) => {
    s.contents = Object.fromEntries(
      Array.from({ length: 64 }, (_, i) => [
        "saved-" + i,
        { id: "saved-" + i },
      ]),
    );
  });
  await assert.rejects(
    runtime.call("contentSave", { observationId: o.id, name: "Over count" }),
    /count-limit/,
  );
  assert.equal(Object.keys(store.data.contents).length, 64);
  await store.change((s) => {
    s.contents = {
      large: { id: "large", privateText: "x".repeat(8 * 1024 * 1024) },
    };
  });
  await assert.rejects(
    runtime.call("contentSave", { observationId: o.id, name: "Over bytes" }),
    /byte-limit/,
  );
  assert.equal(store.data.contents.large.privateText.length, 8 * 1024 * 1024);
});
test("repeated-item navigation requires one exact observed link argument and never chooses an arbitrary first card", async (t) => {
  const { runtime, session } = await fixture(t, 500),
    p = listPack();
  p.permissions.push("click");
  p.procedures = [
    {
      id: "open",
      parameters: ["linkUrl"],
      preconditions: [],
      postconditions: [],
      steps: [{ kind: "click", role: "cards", linkParameter: "linkUrl" }],
    },
  ];
  const o = cards(session);
  await activate(runtime, session, p, o, ["click"]);
  const run = runtime.call("packRun", {
    id: p.id,
    procedure: "open",
    operationId: "pick-card",
    arguments: { linkUrl: "https://example.com/two" },
  });
  let c = await pending(runtime);
  runtime.reply(session, c.id, cards(session));
  c = await pending(runtime);
  assert.equal(c.args.action.target, "a2");
  assert.equal(c.args.target.href, "https://example.com/two");
  runtime.reply(session, c.id, {
    accepted: true,
    delivery: "synthetic-dispatched",
    outcome: "unknown",
    reason: "fixture",
  });
  assert.equal((await run).delivery, "synthetic-dispatched");
  const ambiguous = runtime.call("packRun", {
    id: p.id,
    procedure: "open",
    operationId: "ambiguous-card",
    arguments: { linkUrl: "https://example.com/one" },
  });
  c = await pending(runtime);
  const dup = cards(session);
  dup.nodes[2].href = dup.nodes[0].href;
  runtime.reply(session, c.id, dup);
  const result = await ambiguous;
  assert.equal(result.delivery, "not-sent");
  assert.equal(runtime.pending, null);
});
