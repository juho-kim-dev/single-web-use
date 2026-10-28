import { editDefinition, createOverlay } from "./editor.js";
const $ = (id) => document.getElementById(id);
let observation = null,
  selected = null,
  revision = null,
  expected = null,
  savedDefinition = null,
  formDirty = false,
  activeRevision = null,
  lastReading = null;
const fields = [
  "id",
  "name",
  "version",
  "origin",
  "pathPrefix",
  "role",
  "selector",
  "extract",
  "cardinality",
  "limit",
  "kind",
  "procedure",
  "parameter",
  "value",
];
const fieldIds = {
  id: "authorId",
  name: "authorName",
  version: "authorVersion",
  origin: "authorOrigin",
  pathPrefix: "authorPath",
  role: "authorRole",
  selector: "authorSelector",
  extract: "authorExtract",
  cardinality: "authorCardinality",
  limit: "authorLimit",
  kind: "authorKind",
  procedure: "authorProcedure",
  parameter: "authorParameter",
  value: "authorValue",
};
for (const name of fields)
  $(fieldIds[name]).addEventListener("input", () => {
    formDirty = true;
  });
function populate(pack) {
  const role = pack.roles[0];
  const values = {
    id: pack.id,
    name: pack.name,
    version: pack.version,
    origin: pack.scope.origin ?? "",
    pathPrefix: pack.scope.pathPrefix,
    role: role.id,
    selector: role.locator.selector,
    extract: role.extract,
    cardinality: role.cardinality ?? "one",
    limit: role.limit ?? 50,
    kind: "read",
    procedure: "use-target",
    parameter: "",
    value: "",
  };
  for (const name of fields) $(fieldIds[name]).value = values[name];
  formDirty = false;
}
function remember(pack) {
  savedDefinition = JSON.stringify(pack);
  $("editor").value = JSON.stringify(pack, null, 2);
  populate(pack);
  for (const id of ["ackRead", "ackFill", "ackClick", "ackScroll"])
    $(id).checked = false;
  $("revisionStatus").textContent =
    `Draft ${revision ?? "unsaved"} · active ${activeRevision ?? "off"}`;
}
function assertSaved() {
  if (!selected || !revision || !savedDefinition)
    throw Error("Save the draft before testing or activation");
  if (
    formDirty ||
    JSON.stringify(JSON.parse($("editor").value)) !== savedDefinition
  )
    throw Error("Save editor changes as a draft first");
}
$("operationId").value = crypto.randomUUID();
async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (response.error) throw Error(response.error);
  return response.result;
}
const api = (method, args = {}) => send({ type: "api", method, args });
function report(value) {
  $("packResult").textContent = JSON.stringify(value, null, 2);
}
function action(id, fn) {
  $(id).addEventListener("click", async () => {
    $(id).disabled = true;
    try {
      await fn();
      $("status").textContent = "Done · review the result and evidence.";
    } catch (e) {
      $("status").textContent = e.message;
    } finally {
      $(id).disabled = false;
    }
  });
}
for (const button of document.querySelectorAll("[data-tab]"))
  button.addEventListener("click", () => {
    for (const section of document.querySelectorAll("main > section"))
      section.hidden = section.id !== button.dataset.tab;
    for (const b of document.querySelectorAll("[data-tab]"))
      b.setAttribute("aria-selected", String(b === button));
  });
const status = await send({ type: "status" });
$("identity").textContent = "Extension ID: " + status.extensionId;
$("status").textContent = status.connected
  ? "Connected to foreground tab"
  : (status.lastError ?? "Not connected");
action("saveToken", async () => {
  if (!/^[a-f0-9]{64}$/.test($("token").value))
    throw Error("Expected 64 hexadecimal characters");
  await chrome.storage.local.set({ token: $("token").value });
  $("token").value = "";
});
action("bind", () => send({ type: "bind" }));
action("disconnect", () => send({ type: "disconnect" }));
action("read", async () => {
  observation = await api("observe");
  $("observation").textContent = JSON.stringify(observation, null, 2);
  $("targets").replaceChildren();
  for (const n of observation.nodes.filter((n) => n.locator)) {
    const b = document.createElement("button");
    b.className = "target";
    b.textContent = (n.label || n.text || n.tag).slice(0, 120);
    const small = document.createElement("small");
    small.textContent = `${n.ref} · ${n.tag} · ${n.exposure}`;
    b.append(small);
    b.addEventListener("click", async () => {
      try {
        const id = "personal-" + crypto.randomUUID().slice(0, 8),
          result = await api("packPropose", {
            id,
            name: (n.label || n.tag).slice(0, 200),
            observationId: observation.id,
            target: n.ref,
          });
        selected = id;
        revision = result.revision;
        expected = revision;
        const p = await api("packGet", { id });
        activeRevision = p.active;
        remember(p.revisions[revision]);
        report(result);
        document.querySelector("[data-tab=packs]").click();
      } catch (e) {
        $("status").textContent = e.message;
      }
    });
    $("targets").append(b);
  }
});
async function refresh() {
  const packs = await api("packs");
  $("packList").replaceChildren(new Option("Select a pack", ""));
  for (const p of packs)
    $("packList").add(
      new Option(`${p.id}${p.active ? " · active" : ""}`, p.id),
    );
  report(packs);
}
action("refresh", refresh);
action("load", async () => {
  selected = $("packList").value;
  const p = await api("packGet", { id: selected });
  revision = p.draft;
  expected = p.draft;
  activeRevision = p.active;
  remember(p.revisions[revision]);
  report({ id: selected, revision, active: p.active, tests: p.tests });
});
action("new", async () => {
  selected = null;
  revision = null;
  expected = null;
  savedDefinition = null;
  activeRevision = null;
  formDirty = false;
  $("editor").value = "";
  populate({
    id: "personal-" + crypto.randomUUID().slice(0, 8),
    name: "New personal ability",
    version: "0.1.0",
    scope: {
      origin: observation ? new URL(observation.url).origin : null,
      pathPrefix: "/",
    },
    roles: [{ id: "target", locator: { selector: "" }, extract: "text" }],
  });
  $("revisionStatus").textContent = "New unsaved draft · active off";
  report({
    next: "Read current viewport and choose a target, or paste a package.",
  });
});
async function save(method) {
  if (formDirty) throw Error("Apply author fields to the draft before saving");
  const pack = JSON.parse($("editor").value);
  if (selected && pack.id !== selected)
    throw Error("Use New draft before changing package identity");
  const r = await api(method, { pack, expected });
  selected = r.id;
  revision = r.revision;
  expected = revision;
  const p = await api("packGet", { id: selected });
  activeRevision = p.active;
  remember(p.revisions[revision]);
  report(r);
}
action("save", () => save("packDraft"));
action("import", () => save("packImport"));
action("test", async () => {
  assertSaved();
  const result = await api("packTest", { id: selected, revision });
  report(result);
  $("permissionSummary").textContent =
    "New permissions requiring acknowledgement: " +
    (result.addedPermissions.join(", ") || "none");
});
action("activate", async () => {
  assertSaved();
  const acknowledgePermissions = ["read", "fill", "click", "scroll"].filter(
    (p, i) => $(["ackRead", "ackFill", "ackClick", "ackScroll"][i]).checked,
  );
  const result = await api("packActivate", {
    id: selected,
    revision,
    acknowledgePermissions,
  });
  report(result);
  activeRevision = result.active;
  $("revisionStatus").textContent =
    `Draft ${revision} · active ${activeRevision}`;
});
action("overlay", async () => {
  assertSaved();
  const base = JSON.parse($("editor").value),
    baseRevision = revision;
  if (!baseRevision) throw Error("Save the base first");
  const id = "personal-" + crypto.randomUUID().slice(0, 8);
  const pack = createOverlay(
    base,
    baseRevision,
    id,
    observation ? new URL(observation.url).origin : base.scope.origin,
  );
  selected = null;
  revision = null;
  expected = null;
  activeRevision = null;
  remember(pack);
  savedDefinition = null;
  $("revisionStatus").textContent = "Unsaved personal overlay; base preserved";
});
action("deactivate", async () => {
  if (!activeRevision) throw Error("No active revision loaded");
  report(
    await api("packDeactivate", { id: selected, expected: activeRevision }),
  );
  activeRevision = null;
  $("revisionStatus").textContent = `Draft ${revision} · active off`;
});
action("applyFields", async () => {
  const current = $("editor").value ? JSON.parse($("editor").value) : null;
  const draft = editDefinition(
    current,
    Object.fromEntries(fields.map((name) => [name, $(fieldIds[name]).value])),
  );
  if (selected && draft.id !== selected)
    throw Error("Use New draft for a different pack ID");
  $("editor").value = JSON.stringify(draft, null, 2);
  formDirty = false;
  $("revisionStatus").textContent =
    `Unsaved definition · active ${activeRevision ?? "off"}`;
});
action("preview", async () =>
  report(
    await api("packUpdatePreview", {
      id: selected,
      pack: JSON.parse($("editor").value),
    }),
  ),
);
action("context", async () => {
  observation = await api("observe");
  report(await api("packContext", { observationId: observation.id }));
});
action("export", async () => {
  const definition = await api("packExport", { id: selected, revision });
  const blob = new Blob([JSON.stringify(definition, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `${definition.id}-${definition.version}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  report({
    exported:
      "definition only; review selectors and labels for private information",
  });
});
action("newOperation", async () => {
  $("operationId").value = crypto.randomUUID();
});
action("run", async () => {
  assertSaved();
  report(
    await api("packRun", {
      id: selected,
      procedure: $("procedure").value,
      operationId: $("operationId").value,
      arguments: JSON.parse($("arguments").value),
    }),
  );
});
action("receipt", async () =>
  report(await api("operation", { operationId: $("operationId").value })),
);
action("cancel", async () =>
  report(await api("cancel", { operationId: $("operationId").value })),
);
const showReading = (value) => {
  $("observation").textContent = JSON.stringify(value, null, 2);
};
action("filteredRead", async () => {
  const packId = $("readPack").value;
  lastReading = await api("read", {
    kinds: $("readKinds").value.split(","),
    ...(packId ? { packId } : {}),
  });
  showReading(lastReading);
});
action("nextPage", async () => {
  if (!lastReading?.continuation) throw Error("No next page");
  lastReading = await api(
    lastReading.continuation.method,
    lastReading.continuation.args,
  );
  showReading(lastReading);
});
action("discover", async () =>
  showReading(
    await api("capabilities", {
      ...(lastReading
        ? { observationId: lastReading.observationId }
        : observation
          ? { observationId: observation.id }
          : {}),
      purpose: "all",
    }),
  ),
);
action("preserve", async () => {
  if (!lastReading) throw Error("Read a filtered page first");
  const result = await api("contentSave", {
    observationId: lastReading.observationId,
    name: $("saveName").value,
    read: lastReading.filter,
  });
  $("savedId").value = result.id;
  showReading(result);
});
action("savedList", async () => showReading(await api("contentList")));
action("savedRead", async () =>
  showReading(await api("contentRead", { id: $("savedId").value })),
);
action("history", async () => showReading(await api("observationHistory")));
action("diff", async () => {
  const { observations } = await api("observationHistory");
  if (observations.length < 2) throw Error("Need two retained observations");
  showReading(
    await api("observationDiff", {
      before: observations.at(-2).id,
      after: observations.at(-1).id,
    }),
  );
});
