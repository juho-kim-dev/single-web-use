import test from "node:test";
import assert from "node:assert/strict";
import { fixture, observation, action } from "./helpers.js";
import { Runtime } from "../src/runtime.js";
import { StateStore, hash } from "../src/storage.js";
import { handle } from "../src/mcp.js";

async function save(runtime, session, text = "First section", overrides = {}) {
  const o = observation({ session, ...overrides });
  o.nodes[0].text = text;
  runtime.retain(o);
  const entry = await runtime.call("contentSave", {
    observationId: o.id,
    name: text.slice(0, 100),
    read: { kinds: ["text"] },
  });
  return { o, entry };
}
test("append retries bind original expected revision and reconstruct verified historical receipts", async (t) => {
  const { runtime, session, store } = await fixture(t),
    saved = await save(runtime, session);
  const initial = await runtime.call("documentCreate", {
    id: "retry",
    name: "Retry",
    contentId: saved.entry.id,
  });
  const args = {
    id: "retry",
    expected: initial.revision,
    appendId: "part",
    contentId: saved.entry.id,
  };
  const first = await runtime.call("documentAppend", args);
  await runtime.call("documentAppend", {
    ...args,
    expected: first.revision,
    appendId: "later",
  });
  assert.deepEqual(await runtime.call("documentAppend", args), first);
  await assert.rejects(
    runtime.call("documentAppend", { ...args, expected: first.revision }),
    /append-id-conflict/,
  );
  await store.change((s) => {
    s.documents.retry.sections[1].receipt = { revision: "corrupt" };
  });
  await assert.rejects(runtime.call("documentAppend", args), /integrity/);
});
test("explicit accumulated documents preserve original sections, restart, overlap and no input authority", async (t) => {
  const { runtime, session, root } = await fixture(t),
    first = await save(runtime, session),
    second = await save(runtime, session, "Changed section");
  const created = await runtime.call("documentCreate", {
    id: "reading",
    name: "My page",
    contentId: first.entry.id,
  });
  const args = {
    id: "reading",
    expected: created.revision,
    appendId: "second",
    contentId: second.entry.id,
  };
  const appended = await runtime.call("documentAppend", args);
  assert.equal(appended.sections, 2);
  assert.deepEqual(await runtime.call("documentAppend", args), appended);
  const doc = await runtime.call("documentRead", { id: "reading" });
  assert.equal(doc.sections[0].reading.items[0].value.text, "First section");
  assert.equal(doc.sections[1].reading.items[0].value.text, "Changed section");
  assert.equal(doc.coverage.wholePage, "unknown");
  const store = new StateStore(root);
  await store.init();
  const reopened = new Runtime(store);
  assert.deepEqual(await reopened.call("documentRead", { id: "reading" }), doc);
  assert.equal((await reopened.call("documentList", {}))[0].sections, 2);
  await assert.rejects(reopened.call("act", action(first.o)), /expired/);
  assert.equal(reopened.observations.size, 0);
  assert.equal(doc.inputPermission, false);
});
test("document append identity/revision/context conflicts never discard existing evidence", async (t) => {
  const { runtime, session } = await fixture(t),
    one = await save(runtime, session),
    two = await save(runtime, session, "Two");
  const created = await runtime.call("documentCreate", {
    id: "reading",
    name: "Page",
    contentId: one.entry.id,
  });
  const next = await runtime.call("documentAppend", {
    id: "reading",
    expected: created.revision,
    appendId: "part",
    contentId: two.entry.id,
  });
  await assert.rejects(
    runtime.call("documentAppend", {
      id: "reading",
      expected: next.revision,
      appendId: "part",
      contentId: one.entry.id,
    }),
    /append-id-conflict/,
  );
  await assert.rejects(
    runtime.call("documentAppend", {
      id: "reading",
      expected: created.revision,
      appendId: "other",
      contentId: one.entry.id,
    }),
    /revision-conflict/,
  );
  for (const overrides of [
    { url: "https://example.com/other" },
    { documentId: "other-document" },
  ]) {
    const wrong = await save(runtime, session, "Other", overrides);
    await assert.rejects(
      runtime.call("documentAppend", {
        id: "reading",
        expected: next.revision,
        appendId: "wrong",
        contentId: wrong.entry.id,
      }),
      /context-mismatch/,
    );
  }
  assert.equal(
    (await runtime.call("documentRead", { id: "reading" })).sections.length,
    2,
  );
});
test("explicit content export escapes active Markdown/HTML and its manifest verifies exact serialized bytes", async (t) => {
  const { runtime, session, store } = await fixture(t),
    saved = await save(
      runtime,
      session,
      "<script>alert(1)</script> [x](javascript:alert(1))",
    );
  await runtime.call("documentCreate", {
    id: "exported",
    name: "<img src=x onerror=alert(1)>",
    contentId: saved.entry.id,
  });
  await store.change((s) => {
    s.operations.sentinel = {
      receipt: { delivery: "unknown" },
      token: "PRIVATE_SENTINEL",
    };
  });
  const bundle = await runtime.call("documentExport", { id: "exported" });
  assert.equal(hash(bundle.markdown), bundle.manifest.markdownSha256);
  assert.equal(hash(bundle.metadata), bundle.manifest.metadataSha256);
  assert.equal(
    Buffer.byteLength(bundle.metadata),
    bundle.manifest.metadataBytes,
  );
  assert.equal(bundle.manifest.inputPermission, false);
  assert.ok(!bundle.markdown.includes("<script>"));
  assert.ok(!bundle.markdown.includes("[x]("));
  assert.ok(!JSON.stringify(bundle).includes("PRIVATE_SENTINEL"));
  const metadata = JSON.parse(bundle.metadata);
  assert.equal(
    metadata.sections[0].readingSha256,
    hash(metadata.sections[0].reading),
  );
  assert.equal(
    metadata.sections[0].reading.provenance.observationId,
    saved.o.id,
  );
  assert.equal("operations" in metadata, false);
  assert.equal("packs" in metadata, false);
  await store.change((s) => {
    s.documents.exported.sections[0].reading.items[0].value.text = "corrupt";
  });
  await assert.rejects(
    runtime.call("documentRead", { id: "exported" }),
    /integrity/,
  );
  await assert.rejects(
    runtime.call("documentExport", { id: "exported" }),
    /integrity/,
  );
});
test("document byte and count limits reject without losing prior revisions", async (t) => {
  const { runtime, session, store } = await fixture(t),
    saved = await save(runtime, session);
  const reading = structuredClone(store.data.contents[saved.entry.id].reading);
  reading.items = Array.from({ length: 100 }, () => ({
    ...reading.items[0],
    value: { text: "x".repeat(4000) },
  }));
  await store.change((s) => {
    s.contents.large = { id: "large", name: "Large", reading };
  });
  let current = await runtime.call("documentCreate", {
      id: "large-doc",
      name: "Large",
      contentId: "large",
    }),
    failed = false;
  for (let i = 0; i < 8; i++) {
    try {
      current = await runtime.call("documentAppend", {
        id: "large-doc",
        expected: current.revision,
        appendId: "part-" + i,
        contentId: "large",
      });
    } catch (e) {
      assert.match(e.message, /byte-limit/);
      failed = true;
      break;
    }
  }
  assert.equal(failed, true);
  assert.equal(
    (await runtime.call("documentRead", { id: "large-doc" })).revision,
    current.revision,
  );
  for (let i = 0; i < 15; i++)
    await runtime.call("documentCreate", {
      id: "doc-" + i,
      name: "Small",
      contentId: saved.entry.id,
    });
  await assert.rejects(
    runtime.call("documentCreate", {
      id: "overflow",
      name: "Too many",
      contentId: saved.entry.id,
    }),
    /count-limit/,
  );
  assert.equal((await runtime.call("documentList", {})).length, 16);
});
test("MCP discovers strict document operations and executes against the same saved store", async (t) => {
  const { runtime, session } = await fixture(t),
    saved = await save(runtime, session);
  const list = await handle({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.ok(
    list.result.tools.find((t) => t.name === "documentAppend").inputSchema
      .properties.expected,
  );
  const response = await handle(
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "documentCreate",
        arguments: {
          id: "mcp-doc",
          name: "MCP reading",
          contentId: saved.entry.id,
        },
      },
    },
    (name, args) => runtime.call(name, args),
  );
  assert.equal(response.result.isError, false);
  assert.equal((await runtime.call("documentList", {}))[0].id, "mcp-doc");
});
