import { pageCommand } from "./page.js";
let binding = null,
  session = null,
  running = false,
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
  const tab = await chrome.tabs.get(bound.tabId),
    window = await chrome.windows.get(bound.windowId);
  if (
    !tab.active ||
    tab.windowId !== bound.windowId ||
    !window.focused ||
    window.state === "minimized" ||
    !/^https?:/.test(tab.url ?? "")
  )
    throw Error("bound-tab-must-be-active-in-focused-window");
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
    if (message.type === "bind") {
      if (running) throw Error("disconnect-before-rebind");
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const bound = { tabId: tab.id, windowId: tab.windowId };
      binding = bound;
      await foreground(bound);
      const result = await request("/bridge/bind", bound);
      if (binding !== bound) throw Error("binding-changed-during-connect");
      session = result.session;
      documents.clear();
      void loop();
      return { connected: true };
    }
    if (message.type === "disconnect") {
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
