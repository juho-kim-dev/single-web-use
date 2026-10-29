import { pageCommand } from "./page.js";
let binding = null,
  session = null,
  running = false,
  connecting = false,
  epoch = 0;
const base = "http://127.0.0.1:47831";
async function request(route, body) {
  const { token } = await chrome.storage.local.get("token");
  if (!/^[a-f0-9]{64}$/.test(token ?? ""))
    throw Error("pairing-token-required");
  const response = await fetch(base + route, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-swu-extension": chrome.runtime.id,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (result.error) throw Error(result.error);
  return result.result;
}
async function foreground(bound) {
  if (!bound) throw Error("tab-not-bound");
  const tab = await chrome.tabs.get(bound.tabId).catch((e) => {
    throw Error(
      /^No tab with id: \d+\.?$/.test(e?.message ?? "")
        ? "bound-tab-not-found"
        : "bound-tab-query-failed",
    );
  });
  if (!tab) throw Error("bound-tab-missing");
  const window = await chrome.windows.get(bound.windowId).catch(() => {
    throw Error("bound-window-unavailable");
  });
  if (!window) throw Error("bound-window-unavailable");
  if (!tab.active) throw Error("bound-tab-inactive");
  if (tab.windowId !== bound.windowId) throw Error("bound-tab-window-mismatch");
  if (!window.focused) throw Error("bound-window-unfocused");
  if (window.state === "minimized") throw Error("bound-window-minimized");
  if (typeof tab.url !== "string" || !tab.url)
    throw Error("bound-tab-url-unavailable");
  if (!/^https?:/.test(tab.url)) throw Error("bound-tab-url-not-http");
  return tab;
}
async function execute(command, retire) {
  let injected = false;
  const bound = binding,
    ownedSession = session;
  try {
    const ownedEpoch = epoch;
    const guard = () => {
      if (
        !bound ||
        binding !== bound ||
        session !== ownedSession ||
        command.session !== ownedSession ||
        epoch !== ownedEpoch ||
        Date.now() > command.deadline
      )
        throw Error("command-expired-or-binding-changed");
    };
    guard();
    await foreground(bound);
    guard();
    const context = {
      ...bound,
      session: ownedSession,
      deadline: command.deadline,
    };
    const target = {
      tabId: bound.tabId,
      ...(command.kind === "observe" ? { frameIds: [0] } : {}),
    };
    // Chrome documentId remains adapter-private; the core uses isolated collector documentId.
    if (command.kind === "act") {
      const chromeDocumentId = documents.get(command.args.before.id);
      if (!chromeDocumentId) throw Error("chrome-document-binding-expired");
      target.documentIds = [chromeDocumentId];
    }
    injected = true;
    const results = await chrome.scripting.executeScript({
      target,
      world: "ISOLATED",
      func: pageCommand,
      args: [command.kind, command.args, context],
    });
    if (
      results.length !== 1 ||
      results[0].frameId !== 0 ||
      !results[0].documentId ||
      results[0].error
    )
      throw Error("main-document-unconfirmed");
    guard();
    await foreground(bound);
    guard();
    const result = results[0].result;
    if (command.kind === "observe") {
      documents.set(result.id, results[0].documentId);
      if (documents.size > 32) documents.delete(documents.keys().next().value);
    }
    return result;
  } catch (e) {
    if (
      ["bound-tab-not-found", "bound-tab-missing"].includes(e.message) &&
      binding === bound
    )
      retire(e.message);
    if (command.kind === "act")
      return {
        accepted: true,
        delivery: injected ? "unknown" : "not-sent",
        outcome: "unknown",
        reason: injected
          ? "adapter-after-possible-execution-no-retry"
          : "adapter-pre-dispatch-refusal:" + e.message,
      };
    throw e;
  }
}
const documents = new Map();
let documentQueue = Promise.resolve();
async function documentRequest(message) {
  const { documentAppendRequests = {} } = await chrome.storage.local.get(
    "documentAppendRequests",
  );
  const persist = () => chrome.storage.local.set({ documentAppendRequests });
  if (message.type === "documentReload") {
    const result = await request("/api", {
      method: "documentRead",
      args: { id: message.args.id },
    });
    for (const [key, entry] of Object.entries(documentAppendRequests))
      if (entry.conflict && entry.request.id === result.id)
        delete documentAppendRequests[key];
    await persist();
    return result;
  }
  const { id, contentId, expected } = message.args;
  const key = JSON.stringify([id, contentId]);
  if (!Object.hasOwn(documentAppendRequests, key)) {
    if (Object.keys(documentAppendRequests).length >= 1024)
      throw Error(
        "Document append retry storage full; use the explicit CLI API",
      );
    documentAppendRequests[key] = {
      request: { id, contentId, expected, appendId: crypto.randomUUID() },
      conflict: false,
    };
  }
  // One worker serializes all popup intents and persists them before any possible delivery.
  await persist();
  try {
    return await request("/api", {
      method: "documentAppend",
      args: documentAppendRequests[key].request,
    });
  } catch (e) {
    if (e.message === "reading-document-revision-conflict") {
      documentAppendRequests[key].conflict = true;
      await persist();
    }
    throw e;
  }
}
const invalidate = () => {
  epoch++;
  documents.clear();
};
chrome.tabs.onActivated.addListener(invalidate);
chrome.windows.onFocusChanged.addListener(invalidate);
async function disconnectOwned(
  manual = false,
  reason = null,
  expectedSession = session,
) {
  invalidate();
  session = null;
  binding = null;
  running = false;
  const ticket = epoch;
  await chrome.storage.session.set({
    userDisconnected: manual,
    lastError: reason,
  });
  if (!expectedSession) return { disconnected: true };
  try {
    await request("/bridge/disconnect-owned", { expectedSession });
    return { disconnected: true };
  } catch (e) {
    if (ticket === epoch)
      await chrome.storage.session.set({
        lastError: "binding-cleanup-unconfirmed",
      });
    return { disconnected: true, cleanupConfirmed: false };
  }
}
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === binding?.tabId)
    void disconnectOwned(false, "bound-tab-removed");
});
chrome.tabs.onReplaced?.addListener((addedTabId, removedTabId) => {
  if (removedTabId === binding?.tabId)
    void disconnectOwned(false, "bound-tab-replaced");
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (tabId === binding?.tabId && (change.url || change.status === "loading"))
    invalidate();
});
async function loop() {
  if (running) return;
  const loopSession = session;
  running = loopSession;
  try {
    while (session === loopSession) {
      const activeSession = session,
        { command } = await request("/bridge/poll", { session: activeSession });
      if (session !== loopSession) break;
      if (command) {
        let result, retireReason;
        try {
          result = await execute(command, (reason) => {
            retireReason = reason;
          });
        } catch (e) {
          result =
            command.kind === "act"
              ? {
                  accepted: true,
                  delivery: "unknown",
                  outcome: "unknown",
                  reason: "adapter-unconfirmed-no-retry",
                }
              : { error: e.message };
        }
        await request("/bridge/reply", {
          session: activeSession,
          id: command.id,
          result,
        });
        if (retireReason && session === activeSession)
          await disconnectOwned(false, retireReason, activeSession);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  } catch (e) {
    if (session === loopSession)
      await disconnectOwned(false, e.message, loopSession);
  } finally {
    if (running === loopSession) running = false;
  }
}
async function connectTab(tab, automatic = false, ownsAttempt = false) {
  if (!ownsAttempt && connecting) throw Error("disconnect-before-rebind");
  connecting = true;
  let bound, automaticIntent;
  const ticket = epoch;
  try {
    if (!tab || !Number.isInteger(tab.id) || !Number.isInteger(tab.windowId))
      throw Error("connect-tab-not-found");
    const candidate = { tabId: tab.id, windowId: tab.windowId };
    if (!running) {
      bound = candidate;
      binding = bound;
    }
    await foreground(candidate);
    if (ticket !== epoch) throw Error("binding-changed-during-connect");
    if (automatic) {
      const { userDisconnected } =
        await chrome.storage.session.get("userDisconnected");
      if (userDisconnected) throw Error("explicit-disconnect-retained");
      let status;
      try {
        status = await request("/api", { method: "status", args: {} });
      } catch (e) {
        throw Error(
          e.message === "pairing-token-required"
            ? e.message
            : "runtime-unavailable",
        );
      }
      if (status.bindProtocol !== "guarded-auto-v1")
        throw Error("runtime-update-restart-required");
      automaticIntent = {
        intent: "automatic",
        observedSession: status.session,
      };
      if (status.paused) throw Error("runtime-paused");
      if (status.fenced) throw Error("surface-fenced-rebind-required");
      if (running && status.session !== session)
        throw Error("automatic-bind-session-changed");
    }
    if (running) {
      if (
        binding?.tabId === candidate.tabId &&
        binding?.windowId === candidate.windowId
      )
        return { connected: true };
      throw Error("disconnect-before-rebind");
    }
    if (automatic) await foreground(bound);
    if (binding !== bound || ticket !== epoch)
      throw Error("binding-changed-during-connect");
    const result = await request("/bridge/bind", {
      ...bound,
      ...automaticIntent,
    });
    if (typeof result?.session !== "string" || !result.session)
      throw Error("binding-unconfirmed");
    if (binding !== bound || ticket !== epoch) {
      await request("/bridge/disconnect-owned", {
        expectedSession: result.session,
      }).catch(() =>
        chrome.storage.session.set({
          lastError: "binding-cleanup-unconfirmed",
        }),
      );
      throw Error("binding-changed-during-connect");
    }
    session = result.session;
    documents.clear();
    await chrome.storage.session.set({
      userDisconnected: false,
      lastError: null,
    });
    if (binding !== bound || session !== result.session)
      throw Error("binding-changed-during-connect");
    void loop();
    return { connected: true };
  } catch (e) {
    if (bound && binding === bound) {
      binding = null;
      session = null;
      documents.clear();
    }
    throw e;
  } finally {
    connecting = false;
  }
}
chrome.action?.onClicked.addListener((tab) => {
  // Chrome requires this call inside the toolbar gesture, before any await.
  let opening;
  try {
    opening = chrome.sidePanel.open({ windowId: tab.windowId });
  } catch {
    void chrome.storage.session.set({ lastError: "side-panel-open-failed" });
    return;
  }
  void Promise.resolve(opening)
    .catch(() => {
      throw Error("side-panel-open-failed");
    })
    .then(() => connectTab(tab, true))
    .catch((e) => chrome.storage.session.set({ lastError: e.message }));
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    sender.id !== chrome.runtime.id ||
    sender.url !== chrome.runtime.getURL("popup.html")
  )
    return;
  (async () => {
    if (
      message.type === "documentAppend" ||
      message.type === "documentReload"
    ) {
      const result = documentQueue.then(() => documentRequest(message));
      documentQueue = result.catch(() => {});
      return result;
    }
    if (message.type === "bind") {
      if (!Number.isInteger(message.windowId))
        throw Error("panel-window-required");
      if (connecting) throw Error("disconnect-before-rebind");
      connecting = true;
      const requestedEpoch = epoch;
      try {
        const tabs = await chrome.tabs
          .query({ active: true, windowId: message.windowId })
          .catch(() => {
            throw Error("connect-tab-query-failed");
          });
        if (requestedEpoch !== epoch)
          throw Error("binding-changed-during-connect");
        return await connectTab(tabs?.[0], false, true);
      } finally {
        connecting = false;
      }
    }
    if (message.type === "panelStatus") {
      const { token } = await chrome.storage.local.get("token");
      if (!/^[a-f0-9]{64}$/.test(token ?? ""))
        return { paired: false, runtimeAvailable: false };
      try {
        const ownedSession = session,
          ownedBinding = binding,
          ownedEpoch = epoch;
        const runtime = await request("/api", { method: "status", args: {} });
        if (runtime.bindProtocol !== "guarded-auto-v1")
          return {
            paired: true,
            runtimeAvailable: true,
            runtime,
            adapterOwned: false,
            foregroundReady: false,
            lastError: "runtime-update-restart-required",
          };
        let adapterOwned =
          !!ownedSession &&
          !!ownedBinding &&
          runtime.session === ownedSession &&
          runtime.binding?.tabId === ownedBinding.tabId &&
          runtime.binding?.windowId === ownedBinding.windowId;
        let foregroundReady = false;
        if (adapterOwned && runtime.binding?.windowId === message.windowId) {
          try {
            await foreground(runtime.binding);
            foregroundReady = true;
          } catch (e) {
            if (
              ["bound-tab-not-found", "bound-tab-missing"].includes(
                e.message,
              ) &&
              session === ownedSession &&
              binding === ownedBinding
            )
              await disconnectOwned(false, e.message, ownedSession);
            else await chrome.storage.session.set({ lastError: e.message });
          }
        }
        const flags = await chrome.storage.session.get([
          "userDisconnected",
          "lastError",
        ]);
        adapterOwned =
          adapterOwned &&
          session === ownedSession &&
          binding === ownedBinding &&
          epoch === ownedEpoch;
        foregroundReady = foregroundReady && adapterOwned;
        return {
          paired: true,
          adapterOwned,
          userDisconnected: flags.userDisconnected === true,
          runtimeAvailable: true,
          lastError: flags.lastError,
          runtime,
          foregroundReady,
        };
      } catch {
        return { paired: true, runtimeAvailable: false };
      }
    }
    if (message.type === "disconnect") {
      return disconnectOwned(true);
    }
    if (message.type === "api")
      return request("/api", { method: message.method, args: message.args });
    if (message.type === "status")
      return {
        connected: !!session,
        extensionId: chrome.runtime.id,
        ...(await chrome.storage.session.get("lastError")),
      };
    throw Error("unknown-ui-message");
  })().then(
    (result) => respond({ result }),
    (e) => respond({ error: e.message }),
  );
  return true;
});
