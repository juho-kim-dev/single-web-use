import { hash } from "./storage.js";

const bytes = (value) => Buffer.byteLength(JSON.stringify(value));
const contextFor = (reading) => {
  const { url, surfaceId, session, documentId, generation } =
    reading.provenance;
  return { url, surfaceId, session, documentId, generation };
};
const revisionOf = (doc) =>
  hash({
    id: doc.id,
    name: doc.name,
    context: doc.context,
    createdAt: doc.createdAt,
    creationDigest: doc.creationDigest,
    sections: doc.sections,
  });
const summary = (doc) => ({
  id: doc.id,
  name: doc.name,
  revision: doc.revision,
  sections: doc.sections.length,
  context: structuredClone(doc.context),
  createdAt: doc.createdAt,
  inputPermission: false,
});
const literal = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replace(/[\\`*_{}\[\]()#+.!|~>-]/g, "\\$&")
    .replaceAll("\r", "");

export class ReadingDocuments {
  constructor(store) {
    this.store = store;
  }
  get(id) {
    const doc = this.store.data.documents?.[id];
    if (!doc) throw Error("reading-document-not-found");
    if (
      !doc.sections.length ||
      doc.sections.length > 64 ||
      bytes(doc) > 2 * 1024 * 1024 ||
      doc.sections.some(
        (s) =>
          hash(s.reading) !== s.digest ||
          hash(contextFor(s.reading)) !== hash(doc.context),
      ) ||
      revisionOf(doc) !== doc.revision
    )
      throw Error("reading-document-integrity-failed");
    return structuredClone(doc);
  }
  content(id) {
    const entry = this.store.data.contents?.[id];
    if (!entry) throw Error("saved-content-not-found");
    return structuredClone(entry.reading);
  }
  async create({ id, name, contentId }) {
    const reading = this.content(contentId),
      creationDigest = hash({ name, contentId, reading });
    if (this.store.data.documents?.[id]) {
      const old = this.get(id);
      if (old.creationDigest !== creationDigest)
        throw Error("reading-document-id-conflict");
      return summary(old);
    }
    const doc = {
      id,
      name,
      createdAt: Date.now(),
      creationDigest,
      context: contextFor(reading),
      sections: [
        {
          id: "initial",
          contentId,
          digest: hash(reading),
          addedAt: Date.now(),
          reading,
        },
      ],
    };
    doc.revision = revisionOf(doc);
    return this.save(doc, null);
  }
  async append({ id, expected, appendId, contentId }) {
    const doc = this.get(id),
      reading = this.content(contentId),
      digest = hash(reading);
    if (appendId === "initial") throw Error("reserved-append-id");
    const index = doc.sections.findIndex((s) => s.id === appendId),
      old = doc.sections[index];
    if (old) {
      if (
        old.digest !== digest ||
        old.contentId !== contentId ||
        old.expected !== expected
      )
        throw Error("reading-document-append-id-conflict");
      const historical = { ...doc, sections: doc.sections.slice(0, index + 1) };
      historical.revision = revisionOf(historical);
      return summary(historical);
    }
    if (doc.revision !== expected)
      throw Error("reading-document-revision-conflict");
    if (hash(doc.context) !== hash(contextFor(reading)))
      throw Error("reading-document-context-mismatch-create-another-document");
    if (doc.sections.length >= 64)
      throw Error("reading-document-section-limit");
    const section = {
      id: appendId,
      contentId,
      expected,
      digest,
      addedAt: Date.now(),
      reading,
    };
    doc.sections.push(section);
    doc.revision = revisionOf(doc);
    await this.save(doc, expected);
    return summary(doc);
  }
  async save(doc, expected) {
    if (bytes(doc) > 2 * 1024 * 1024)
      throw Error("reading-document-byte-limit");
    return this.store.change((s) => {
      s.documents ??= {};
      if ((s.documents[doc.id]?.revision ?? null) !== expected)
        throw Error("reading-document-revision-conflict");
      if (!s.documents[doc.id] && Object.keys(s.documents).length >= 16)
        throw Error("reading-document-count-limit");
      const next = { ...s.documents, [doc.id]: doc };
      if (bytes(next) > 8 * 1024 * 1024)
        throw Error("reading-document-total-byte-limit");
      s.documents = next;
      return summary(doc);
    });
  }
  list() {
    return Object.keys(this.store.data.documents ?? {}).map((id) =>
      summary(this.get(id)),
    );
  }
  read(id) {
    return {
      ...this.get(id),
      currentAtRead: "not-checked",
      inputPermission: false,
      coverage: {
        wholePage: "unknown",
        atomicWholePage: false,
        overlap: "preserved-as-separate-sections",
        unobserved: "unknown-not-empty",
      },
    };
  }
  export(id) {
    const doc = this.read(id);
    const metadata = {
      format: "paw-swu-reading-document",
      schemaVersion: 1,
      id: doc.id,
      name: doc.name,
      revision: doc.revision,
      context: doc.context,
      createdAt: doc.createdAt,
      coverage: doc.coverage,
      sections: doc.sections.map((s, i) => ({
        sequence: i + 1,
        reading: s.reading,
        readingSha256: s.digest,
      })),
      currentAtRead: "not-checked",
      inputPermission: false,
    };
    const lines = [
      "# " + literal(doc.name),
      "",
      "Historical observed sections; not a complete or current page.",
      "",
    ];
    for (const [i, s] of doc.sections.entries()) {
      lines.push(
        "## Section " + (i + 1),
        "",
        literal(s.reading.provenance.url),
        "Captured: " + literal(s.reading.provenance.at),
        "",
      );
      for (const item of s.reading.items)
        lines.push(
          literal(
            item.mode === "state"
              ? JSON.stringify(item.value)
              : (item.value.text ?? ""),
          ),
          ...(item.mode === "link" ? [literal(item.value.href ?? "")] : []),
          "",
        );
    }
    const markdown = lines.join("\n"),
      metadataText = JSON.stringify(metadata, null, 2);
    const manifest = {
      format: "paw-swu-reading-export",
      schemaVersion: 1,
      documentId: doc.id,
      revision: doc.revision,
      markdownSha256: hash(markdown),
      metadataSha256: hash(metadataText),
      markdownBytes: Buffer.byteLength(markdown),
      metadataBytes: Buffer.byteLength(metadataText),
      currentAtRead: "not-checked",
      inputPermission: false,
    };
    const result = { manifest, markdown, metadata: metadataText };
    if (bytes(result) > 4 * 1024 * 1024)
      throw Error("reading-document-export-byte-limit");
    return result;
  }
}
