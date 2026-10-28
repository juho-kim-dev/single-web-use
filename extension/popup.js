const $ = (id) => document.getElementById(id);
let observation = null,
  selected = null,
  revision = null,
  expected = null,
  savedDefinition = null;
function remember(pack) {
  savedDefinition = JSON.stringify(pack);
  $("editor").value = JSON.stringify(pack, null, 2);
}
function assertSaved() {
  if (JSON.stringify(JSON.parse($("editor").value)) !== savedDefinition)
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
  remember(p.revisions[revision]);
  report({ id: selected, revision, active: p.active, tests: p.tests });
});
action("new", async () => {
  selected = null;
  revision = null;
  expected = null;
  $("editor").value = "";
  report({
    next: "Read current viewport and choose a target, or paste a package.",
  });
});
async function save(method) {
  const pack = JSON.parse($("editor").value);
  if (selected && pack.id !== selected)
    throw Error("Use New draft before changing package identity");
  const r = await api(method, { pack, expected });
  selected = r.id;
  revision = r.revision;
  expected = revision;
  const p = await api("packGet", { id: selected });
  remember(p.revisions[revision]);
  report(r);
}
action("save", () => save("packDraft"));
action("import", () => save("packImport"));
action("test", async () => {
  assertSaved();
  report(await api("packTest", { id: selected, revision }));
});
action("activate", async () => {
  assertSaved();
  report(await api("packActivate", { id: selected, revision }));
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
