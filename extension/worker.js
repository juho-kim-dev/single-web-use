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
  const tab = await chrome.tabs.get(bound.tabId).catch(() => {
    throw Error("bound-tab-unavailable");
  });
  if (!tab) throw Error("bound-tab-unavailable");
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
async function execute(command) {
  let injected = false;
  try {
    const bound = binding,
      ownedSession = session,
      ownedEpoch = epoch;
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
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === binding?.tabId) invalidate();
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (tabId === binding?.tabId && (change.url || change.status === "loading"))
    invalidate();
});
async function loop() {
  if (running) return;
  running = true;
  try {
    while (session) {
      const activeSession = session,
        { command } = await request("/bridge/poll", { session: activeSession });
      if (command) {
        let result;
        try {
          result = await execute(command);
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
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  } catch (e) {
    session = null;
    binding = null;
    await chrome.storage.session.set({ lastError: e.message });
  } finally {
    running = false;
  }
}
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
      if (running || connecting) throw Error("disconnect-before-rebind");
      connecting = true;
      const connectEpoch = epoch;
      let bound;
      try {
        const tabs = await chrome.tabs
          .query({ active: true, currentWindow: true })
          .catch(() => {
            throw Error("connect-tab-query-failed");
          });
        const tab = tabs?.[0];
        if (
          !tab ||
          !Number.isInteger(tab.id) ||
          !Number.isInteger(tab.windowId)
        )
          throw Error("connect-tab-not-found");
        if (connectEpoch !== epoch)
          throw Error("binding-changed-during-connect");
        bound = { tabId: tab.id, windowId: tab.windowId };
        binding = bound;
        await foreground(bound);
        if (binding !== bound) throw Error("binding-changed-during-connect");
        const result = await request("/bridge/bind", bound);
        if (binding !== bound) throw Error("binding-changed-during-connect");
        session = result.session;
        documents.clear();
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
    if (message.type === "disconnect") {
      invalidate();
      session = null;
      binding = null;
      await request("/bridge/disconnect", {});
      return { disconnected: true };
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
