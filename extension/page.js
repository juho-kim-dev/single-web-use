// Serialized by chrome.scripting: this function intentionally has no module dependencies.
export function pageCommand(kind, args, context) {
  const key = "__pawSwuViewportV1";
  let state = globalThis[key];
  if (!state) {
    state = {
      documentId: crypto.randomUUID(),
      generation: 0,
      revision: 0,
      userEpoch: 0,
      nodes: new Map(),
      sequence: 0,
      seen: new Set(),
    };
    state.mutation = new MutationObserver(() => {
      state.revision++;
    });
    state.mutation.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    for (const event of [
      "pointerdown",
      "keydown",
      "input",
      "wheel",
      "touchstart",
    ])
      addEventListener(
        event,
        (e) => {
          if (e.isTrusted) state.userEpoch++;
        },
        { capture: true, passive: true },
      );
    for (const event of ["scroll", "resize"])
      addEventListener(
        event,
        () => {
          state.revision++;
        },
        { capture: true, passive: true },
      );
    for (const event of ["popstate", "hashchange", "pageshow"])
      addEventListener(
        event,
        () => {
          state.generation++;
          state.revision++;
        },
        { capture: true },
      );
    globalThis[key] = state;
  }
  const rect = (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  };
  const viewport = () => ({
    width: visualViewport?.width ?? innerWidth,
    height: visualViewport?.height ?? innerHeight,
    x: visualViewport?.offsetLeft ?? 0,
    y: visualViewport?.offsetTop ?? 0,
    scale: visualViewport?.scale ?? 1,
    dpr: devicePixelRatio,
  });
  const sensitive = (e) =>
    e.matches(
      'input[type=password],input[type=email],input[type=tel],input[type=number],[autocomplete*="cc-"],[autocomplete*="password"],[autocomplete*="one-time-code"]',
    ) ||
    /password|credit.?card|security.?code|token|secret|ssn/i.test(
      [e.id, e.getAttribute("name"), e.getAttribute("autocomplete")].join(" "),
    );
  const visible = (e) => {
    if (
      !(e instanceof HTMLElement) ||
      e.closest('[hidden],[inert],[aria-hidden="true"]')
    )
      return false;
    let n = e;
    while (n) {
      const s = getComputedStyle(n);
      if (
        sensitive(n) ||
        s.display === "none" ||
        s.visibility !== "visible" ||
        Number(s.opacity) === 0
      )
        return false;
      n = n.parentElement;
    }
    const r = rect(e),
      v = viewport();
    return (
      r.width > 0 &&
      r.height > 0 &&
      r.x < v.x + v.width &&
      r.y < v.y + v.height &&
      r.x + r.width > v.x &&
      r.y + r.height > v.y
    );
  };
  const label = (e) => {
    for (const name of ["aria-label", "title", "placeholder"])
      if (e.hasAttribute(name))
        return {
          label: e.getAttribute(name).trim().slice(0, 4000),
          labelSource: name,
        };
    return { label: "", labelSource: "none" };
  };
  const textEvidence = () => ({
    method: "range-fully-inside-viewport-and-overflow-clips",
    truncated: false,
    omitted: false,
    pixels: "unverified",
  });
  const readText = (elements, budget = 16000) => {
    const readings = new Map(
      [...elements.keys()].map((e) => [
        e,
        { text: "", textEvidence: textEvidence() },
      ]),
    );
    const walker = document.createTreeWalker(
      document.body ?? document.documentElement,
      NodeFilter.SHOW_TEXT,
    );
    let node,
      visited = 0,
      examined = 0,
      truncated = false;
    while ((node = walker.nextNode())) {
      if (++visited > 12000) {
        truncated = true;
        break;
      }
      let owner = node.parentElement;
      while (owner && !elements.has(owner)) owner = owner.parentElement;
      if (!owner) continue;
      const result = readings.get(owner),
        v = viewport();
      let clip = {
          left: v.x,
          top: v.y,
          right: v.x + v.width,
          bottom: v.y + v.height,
        },
        supported = true;
      for (
        let parent = node.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        const s = getComputedStyle(parent);
        if (
          sensitive(parent) ||
          parent.matches(
            'script,style,noscript,template,input,textarea,select,[hidden],[inert],[aria-hidden="true"]',
          ) ||
          s.display === "none" ||
          s.visibility !== "visible" ||
          Number(s.opacity) === 0
        ) {
          supported = false;
          break;
        }
        // Unsupported paint/shape effects stay omitted, not guessed as visible text.
        if (
          s.transform !== "none" ||
          s.filter !== "none" ||
          s.clipPath !== "none" ||
          s.clip !== "auto" ||
          s.textOverflow === "ellipsis" ||
          (s.maskImage && s.maskImage !== "none") ||
          s.contentVisibility === "hidden" ||
          (s.webkitLineClamp &&
            s.webkitLineClamp !== "none" &&
            s.webkitLineClamp !== "0")
        ) {
          supported = false;
          break;
        }
        const r = parent.getBoundingClientRect(),
          left = r.left + parent.clientLeft,
          top = r.top + parent.clientTop;
        if (/hidden|clip|scroll|auto/.test(s.overflowX)) {
          clip.left = Math.max(clip.left, left);
          clip.right = Math.min(clip.right, left + parent.clientWidth);
        }
        if (/hidden|clip|scroll|auto/.test(s.overflowY)) {
          clip.top = Math.max(clip.top, top);
          clip.bottom = Math.min(clip.bottom, top + parent.clientHeight);
        }
      }
      if (!supported) {
        result.textEvidence.omitted = true;
        continue;
      }
      const range = document.createRange(),
        data = node.data;
      for (let i = 0; i < data.length; ) {
        if (examined++ >= budget || result.text.length >= 4000) {
          result.textEvidence.truncated = true;
          truncated = true;
          break;
        }
        const next = i + (data.codePointAt(i) > 65535 ? 2 : 1);
        range.setStart(node, i);
        range.setEnd(node, next);
        const rects = [...range.getClientRects()];
        if (
          rects.length &&
          rects.every(
            (r) =>
              r.width > 0 &&
              r.height > 0 &&
              r.left >= clip.left &&
              r.right <= clip.right &&
              r.top >= clip.top &&
              r.bottom <= clip.bottom,
          )
        )
          result.text += data.slice(i, next);
        else result.textEvidence.omitted = true;
        i = next;
      }
      if (examined >= budget) break;
      if (result.text && !/\s$/.test(result.text) && result.text.length < 4000)
        result.text += " ";
    }
    if (truncated)
      for (const r of readings.values()) r.textEvidence.truncated = true;
    for (const r of readings.values()) r.text = r.text.trim();
    return { readings, truncated };
  };
  const locator = (e) => {
    if (e.id && document.querySelectorAll("#" + CSS.escape(e.id)).length === 1)
      return { selector: "#" + CSS.escape(e.id) };
    const parts = [];
    let n = e;
    while (n && n !== document.documentElement && parts.length < 8) {
      const siblings = n.parentElement
        ? [...n.parentElement.children].filter((s) => s.tagName === n.tagName)
        : [];
      parts.unshift(
        n.tagName.toLowerCase() +
          ":nth-of-type(" +
          (siblings.indexOf(n) + 1) +
          ")",
      );
      n = n.parentElement;
    }
    const selector = parts.join(" > ");
    try {
      return document.querySelectorAll(selector).length === 1
        ? { selector }
        : null;
    } catch {
      return null;
    }
  };
  const sample = (e, ref) => {
    const r = rect(e),
      v = viewport(),
      x = (Math.max(r.x, v.x) + Math.min(r.x + r.width, v.x + v.width)) / 2,
      y = (Math.max(r.y, v.y) + Math.min(r.y + r.height, v.y + v.height)) / 2;
    const hit = document.elementFromPoint(x, y),
      exposure =
        hit && (hit === e || e.contains(hit)) ? "hit-tested" : "occluded";
    const editable =
      (e instanceof HTMLInputElement && ["text", "search"].includes(e.type)) ||
      e instanceof HTMLTextAreaElement;
    let href = null;
    try {
      if (
        e instanceof HTMLAnchorElement &&
        /^https?:$/.test(new URL(e.href).protocol) &&
        !new URL(e.href).username &&
        !new URL(e.href).password
      )
        href = e.href.slice(0, 4000);
    } catch {}
    const states = {};
    for (const name of [
      "aria-expanded",
      "aria-checked",
      "aria-selected",
      "aria-pressed",
    ])
      if (e.hasAttribute(name)) states[name] = e.getAttribute(name);
    const matches = [];
    for (const selector of (kind === "observe" ? args.selectors : []) ?? []) {
      try {
        if (e.matches(selector)) matches.push(selector);
      } catch {
        throw Error("invalid-pack-selector");
      }
    }
    return {
      ref,
      tag: e.tagName.toLowerCase(),
      role:
        e.getAttribute("role") ??
        (e instanceof HTMLAnchorElement ? "link" : editable ? "textbox" : ""),
      ...label(e),
      text: "",
      textEvidence: textEvidence(),
      href,
      value: editable && !sensitive(e) ? e.value.slice(0, 4000) : null,
      disabled: !!e.disabled || e.getAttribute("aria-disabled") === "true",
      editable: editable && !sensitive(e) && !e.readOnly,
      rect: r,
      exposure,
      locator: locator(e),
      matches,
      parent: null,
      states,
    };
  };
  const take = () => {
    if (document.visibilityState !== "visible")
      throw Error("document-not-visible");
    state.revision += state.mutation?.takeRecords().length ? 1 : 0;
    const nodes = [],
      elements = new Map(),
      walker = document.createTreeWalker(
        document.body ?? document.documentElement,
        NodeFilter.SHOW_ELEMENT,
      );
    let visited = 0,
      e = walker.currentNode,
      truncated = false;
    while (e) {
      if (++visited > 12000) {
        visited = 12000;
        truncated = true;
        break;
      }
      if (
        visible(e) &&
        !sensitive(e) &&
        (e.matches(
          "a[href],button,input,textarea,select,[role],h1,h2,h3,p,li,td,th,article,label",
        ) ||
          e.scrollHeight > e.clientHeight ||
          e.childElementCount === 0 ||
          (args.selectors ?? []).some((s) => {
            try {
              return e.matches(s);
            } catch {
              throw Error("invalid-pack-selector");
            }
          }))
      ) {
        if (nodes.length >= 300) {
          truncated = true;
          break;
        }
        const ref = "n" + ++state.sequence,
          n = sample(e, ref);
        let parent = e.parentElement;
        while (parent && !elements.has(parent)) parent = parent.parentElement;
        n.parent = parent ? elements.get(parent) : null;
        nodes.push(n);
        elements.set(e, ref);
        state.nodes.set(ref, e);
      }
      e = walker.nextNode();
    }
    const textResult = readText(elements);
    for (const [element, ref] of elements)
      Object.assign(
        nodes.find((n) => n.ref === ref),
        textResult.readings.get(element),
      );
    if (state.nodes.size > 2400) {
      const keep = new Set(nodes.map((n) => n.ref));
      for (const ref of state.nodes.keys())
        if (!keep.has(ref)) state.nodes.delete(ref);
    }
    return {
      id: crypto.randomUUID(),
      surfaceId: String(context.tabId),
      session: context.session,
      documentId: state.documentId,
      generation: state.generation,
      revision: state.revision,
      url: location.href,
      at: Date.now(),
      viewport: viewport(),
      nodes,
      coverage: {
        visited,
        truncated: truncated || textResult.truncated,
        limitations: [
          "bounded-light-dom-and-16000-character-geometry-budget",
          "frames-shadow-canvas-unobserved",
          "hit-test-is-not-pixel-proof",
          "text-range-clips-not-paint-or-occlusion-proof",
          "accessibility-labels-are-metadata-not-read-text",
        ],
      },
      evidence: "dom-and-hit-test-not-pixels",
      userEpoch: state.userEpoch,
    };
  };
  if (kind === "observe") return take();
  if (kind !== "act") throw Error("unsupported-command");
  const { action: a, before, target } = args;
  const refuse = (reason) => ({
    accepted: true,
    delivery: "not-sent",
    outcome: "unknown",
    reason,
  });
  if (state.mutation.takeRecords().length) state.revision++;
  if (state.seen.has(a.operationId))
    return refuse("operation-already-seen-no-retry");
  if (Date.now() > context.deadline || Date.now() - before.at > 30000)
    return refuse("observation-or-command-expired");
  if (
    before.session !== context.session ||
    before.surfaceId !== String(context.tabId) ||
    before.documentId !== state.documentId ||
    before.generation !== state.generation ||
    before.url !== location.href ||
    before.userEpoch !== state.userEpoch ||
    before.revision !== state.revision ||
    document.visibilityState !== "visible" ||
    JSON.stringify(before.viewport) !== JSON.stringify(viewport())
  )
    return refuse("document-viewport-revision-or-user-input-changed");
  const e = state.nodes.get(a.target);
  if (!e?.isConnected || !visible(e) || sensitive(e))
    return refuse("target-not-current-visible-or-sensitive");
  const now = sample(e, a.target);
  if (
    [
      "tag",
      "role",
      "label",
      "labelSource",
      "href",
      "value",
      "disabled",
      "editable",
      "rect",
      "states",
    ].some((k) => JSON.stringify(now[k]) !== JSON.stringify(target[k])) ||
    now.exposure !== "hit-tested" ||
    now.disabled
  )
    return refuse("target-state-geometry-or-hit-test-changed");
  if (
    a.kind === "click" &&
    (!(e instanceof HTMLAnchorElement) ||
      !now.href ||
      (e.target && e.target !== "_self") ||
      e.hasAttribute("download") ||
      e.closest("form") ||
      /logout|log-out|signout|delete|remove|purchase|checkout|unsubscribe|confirm/i.test(
        now.href,
      ))
  )
    return refuse("only-ordinary-same-tab-navigation-links-supported");
  if (
    a.kind === "fill" &&
    (!now.editable || a.expectedValue !== e.value || a.text === undefined)
  )
    return refuse("native-field-or-expected-value-mismatch");
  if (
    a.kind === "scroll" &&
    (!Number.isInteger(a.dy) ||
      Math.abs(a.dy) > 1000 ||
      e.scrollHeight <= e.clientHeight)
  )
    return refuse("target-not-scrollable-or-invalid-delta");
  state.seen.add(a.operationId);
  if (state.seen.size > 10000)
    return refuse("document-operation-limit-reload-before-new-input");
  try {
    if (a.kind === "click") e.click();
    if (a.kind === "fill") {
      e.focus({ preventScroll: true });
      if (
        !e.isConnected ||
        e.value !== a.expectedValue ||
        state.mutation.takeRecords().length ||
        state.userEpoch !== before.userEpoch ||
        location.href !== before.url ||
        Date.now() > context.deadline
      )
        return {
          accepted: true,
          delivery: "unknown",
          outcome: "unknown",
          reason:
            "focus-changed-protected-state; focus-may-have-moved; text-not-written-no-retry",
        };
      const proto =
        e instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(e, a.text);
      e.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: a.text,
        }),
      );
      e.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (a.kind === "scroll") e.scrollBy({ top: a.dy, behavior: "instant" });
    let outcome = "unknown";
    if (a.postcondition?.role === a.target) {
      const c = a.postcondition,
        current = sample(e, a.target);
      outcome =
        c.state === "value"
          ? current.value === c.equals
            ? "observed"
            : "not-observed"
          : c.state === "text"
            ? "unknown"
            : c.state === "enabled"
              ? !current.disabled
                ? "observed"
                : "not-observed"
              : visible(e)
                ? "observed"
                : "unknown";
    }
    return {
      accepted: true,
      delivery: "synthetic-dispatched",
      outcome,
      reason:
        "DOM-synthetic-input; immediate-postcondition-only; causation-unknown",
    };
  } catch {
    return {
      accepted: true,
      delivery: "unknown",
      outcome: "unknown",
      reason: "dispatch-threw-after-possible-input-no-retry",
    };
  }
}
