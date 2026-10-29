// All composition stays within the immutable observation; no browser/DOM reads here.
export function inside(node, root, nodes) {
  const visited = new Set();
  for (
    let current = node;
    current && !visited.has(current.ref);
    current = nodes.get(current.parent)
  ) {
    if (current.ref === root) return true;
    visited.add(current.ref);
  }
  return false;
}
export function composeText(observation, node) {
  const nodes = new Map(observation.nodes.map((n) => [n.ref, n]));
  const sources = observation.nodes.filter((n) => inside(n, node.ref, nodes));
  const segments = sources.flatMap((n, index) =>
    (n.textSegments?.length
      ? n.textSegments
      : [{ order: index, text: n.text }]
    ).map((s) => ({ ...s, ref: n.ref, parent: n.parent })),
  );
  segments.sort((a, b) => a.order - b.order);
  const raw = segments
    .filter((s) => s.text)
    .map((s) => s.text)
    .join(" ");
  return {
    text: raw.slice(0, 4000),
    sources: sources.map((n) => ({
      ref: n.ref,
      parent: n.parent,
      textEvidence: n.textEvidence,
    })),
    segments: segments
      .filter((s) => s.text)
      .map((s) => ({
        ref: s.ref,
        parent: s.parent,
        order: s.order,
        text: s.text,
      })),
    truncated:
      raw.length > 4000 ||
      observation.coverage.truncated ||
      sources.some((n) => n.textEvidence.truncated),
    omitted: sources.some((n) => n.textEvidence.omitted),
    pixels: "unverified",
    basis: "bounded-observed-descendants-only",
  };
}
export function itemFor(observation, node, mode, role = null) {
  const reading = mode === "state" ? null : composeText(observation, node);
  const value =
    mode === "text"
      ? { text: reading.text, reading }
      : mode === "link"
        ? {
            text: reading.text,
            href: node.href,
            reading,
            linkEvidence:
              "same-role-node-DOM-href; no-descendant-or-nearby-URL-substitution",
          }
        : {
            value: node.value,
            disabled: node.disabled,
            editable: node.editable,
            states: node.states,
          };
  return {
    role,
    ref: node.ref,
    mode,
    value,
    metadata: {
      label: node.label,
      labelSource: node.labelSource,
      tag: node.tag,
      role: node.role,
    },
    observationId: observation.id,
    documentId: observation.documentId,
    exposure: node.exposure,
  };
}
export function paginate(items, options, project = (item) => item) {
  const { offset, limit, maxBytes } = options;
  const page = [];
  let bytes = 0,
    index = offset;
  for (; index < items.length && page.length < limit; index++) {
    const item = project(items[index]);
    const size = Buffer.byteLength(JSON.stringify(item));
    if (bytes + size > maxBytes) break;
    page.push(item);
    bytes += size;
  }
  return {
    items: page,
    page: {
      offset,
      limit,
      total: items.length,
      nextOffset: index < items.length ? index : null,
      bytes,
      blocked:
        index < items.length && page.length === 0
          ? "item-exceeds-byte-budget"
          : null,
    },
  };
}
export function diffObservations(before, after) {
  if (
    ["surfaceId", "session", "documentId", "generation", "url"].some(
      (k) => before[k] !== after[k],
    )
  )
    throw Error("incompatible-observations");
  const old = new Map(before.nodes.map((n) => [n.ref, n])),
    next = new Map(after.nodes.map((n) => [n.ref, n]));
  const changed = [];
  for (const [ref, n] of next)
    if (old.has(ref)) {
      const fields = [
        "text",
        "textSegments",
        "label",
        "href",
        "value",
        "disabled",
        "editable",
        "rect",
        "states",
        "scroll",
        "exposure",
        "parent",
      ].filter((k) => JSON.stringify(old.get(ref)[k]) !== JSON.stringify(n[k]));
      if (fields.length) changed.push({ ref, fields });
    }
  return {
    before: before.id,
    after: after.id,
    changed,
    newlyObserved: [...next.keys()].filter((k) => !old.has(k)),
    noLongerObserved: [...old.keys()].filter((k) => !next.has(k)),
    meaning: "observed-subset-difference; no-deletion-or-causation-inference",
    inputPermission: false,
    currentAtRead: "not-checked",
    coverage: { before: before.coverage, after: after.coverage },
  };
}
