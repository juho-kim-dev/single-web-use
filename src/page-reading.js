import { hash } from "./storage.js";
import { applicable, checkConditions, resolveRoles } from "./packs.js";

// Receipts retain bounded capture routes/metrics, never a second private content archive.
export async function runPageReading(runtime, a) {
  const digest = hash(a),
    old = runtime.store.data.operations[a.operationId];
  if (old) {
    if (old.digest !== digest) throw Error("operation-id-conflict");
    return structuredClone(old.receipt);
  }
  if (runtime.paused || runtime.fenced)
    throw Error("page-read-paused-or-fenced");
  const stored = runtime.packs.get(a.packId);
  if (stored.active !== a.packRevision)
    throw Error("page-read-active-revision-mismatch");
  const pack = runtime.packs.effective(a.packId, a.packRevision);
  if (hash(pack) !== a.effectiveRevision)
    throw Error("page-read-effective-revision-mismatch");
  if (
    pack.scope.origin === null ||
    !["read", "scroll"].every((p) => pack.permissions.includes(p))
  )
    throw Error("page-read-origin-read-scroll-required");
  if (
    ![a.scrollRole, ...a.read.roles].every((id) =>
      pack.roles.some((r) => r.id === id),
    )
  )
    throw Error("page-read-unknown-role");
  const session = runtime.session,
    epoch = runtime.pauseEpoch,
    started = Date.now(),
    deadline = started + a.maxElapsedMs;
  const valid = () =>
    runtime.session === session &&
    !!session &&
    runtime.pauseEpoch === epoch &&
    !runtime.paused &&
    !runtime.fenced &&
    !runtime.cancelled.has(a.operationId) &&
    Date.now() < deadline;
  const guard = () => {
    if (!valid())
      throw Error(
        runtime.cancelled.has(a.operationId)
          ? "page-read-cancelled"
          : runtime.paused || runtime.pauseEpoch !== epoch
            ? "page-read-paused"
            : Date.now() >= deadline
              ? "page-read-time-budget"
              : "page-read-binding-or-fence-changed",
      );
  };
  const report = {
    accepted: true,
    delivery: "pending",
    outcome: "unknown",
    reason: "page-read-started",
    operationId: a.operationId,
    packRevision: a.packRevision,
    effectiveRevision: a.effectiveRevision,
    captures: [],
    steps: [],
    contentBytes: 0,
    elapsedMs: 0,
    wholePageRead: "not-established",
    inputPermission: false,
    meaning:
      "bounded-container-observed-subsets; no-auto-save; no-end-deletion-or-causation-inference",
  };
  await runtime.reserve(a.operationId, {
    digest,
    receipt: structuredClone(report),
  });
  runtime.readingProgress.set(a.operationId, report);
  let first = null,
    previous = null,
    targetRef = null;
  const capture = async () => {
    guard();
    const o = await runtime.observe(
      pack.roles.map((r) => r.locator.selector),
      Math.max(1, Math.min(runtime.timeout, deadline - Date.now())),
      a.operationId,
    );
    guard();
    runtime.observed(o.id);
    const roles = resolveRoles(pack, o),
      target = roles[a.scrollRole];
    if (
      !applicable(pack, o) ||
      checkConditions(pack.scope.conditions, roles).some(
        (c) => c.result !== "observed",
      )
    )
      throw Error("page-read-scope-unconfirmed");
    if (
      target?.status !== "matched" ||
      target.truncated ||
      target.totalObserved !== 1 ||
      target.nodes.length !== 1
    )
      throw Error("page-read-scroll-role-unresolved-or-truncated");
    const node = target.nodes[0];
    if (
      !node.scroll ||
      node.scroll.clientHeight <= 0 ||
      node.exposure !== "hit-tested" ||
      node.disabled
    )
      throw Error("page-read-scroll-sample-unconfirmed");
    const context = JSON.stringify([
      o.surfaceId,
      o.session,
      o.documentId,
      o.generation,
      o.url,
      o.viewport,
      o.userEpoch,
      node.rect,
    ]);
    if (first !== null && (first !== context || node.ref !== targetRef))
      throw Error("page-read-context-changed");
    const options = {
      packId: a.packId,
      packRevision: a.packRevision,
      effectiveRevision: a.effectiveRevision,
      roles: a.read.roles,
      kinds: a.read.kinds,
      within: node.ref,
      offset: 0,
      limit: 100,
      maxBytes: Math.max(1024, a.maxContentBytes - report.contentBytes),
    };
    const reading = runtime.read(o.id, options),
      size = Buffer.byteLength(JSON.stringify(reading));
    if (!reading.items.length)
      throw Error("page-read-selection-not-observed-within-container");
    if (reading.page.blocked || size + report.contentBytes > a.maxContentBytes)
      throw Error("page-read-content-budget");
    const contentHash = hash(
      reading.items.map((i) => [
        i.role,
        i.ref,
        i.mode,
        i.value.text ?? null,
        i.value.href ?? null,
        i.mode === "state" ? i.value : null,
      ]),
    );
    const progress = previous
      ? {
          deltaY: node.scroll.y - previous.y,
          contentChanged: contentHash !== previous.contentHash,
          extentChanged: node.scroll.height !== previous.height,
        }
      : null;
    const entry = {
      observationId: o.id,
      documentId: o.documentId,
      url: o.url,
      at: o.at,
      coverage: o.coverage,
      scroll: node.scroll,
      progress,
      contentHash,
      contentBytes: size,
      itemCount: reading.items.length,
      page: reading.page,
      reading: { method: "read", args: { ...options, observationId: o.id } },
      provenance: reading.provenance,
    };
    if (
      Buffer.byteLength(
        JSON.stringify({ ...report, captures: [...report.captures, entry] }),
      ) > 60000
    )
      throw Error("page-read-report-budget");
    first ??= context;
    targetRef ??= node.ref;
    report.captures.push(entry);
    report.contentBytes += size;
    previous = { ...node.scroll, contentHash };
    return { o, node, progress };
  };
  try {
    let current = await capture();
    while (true) {
      guard();
      if (report.steps.length >= a.maxSteps) {
        report.reason = "page-read-step-budget";
        break;
      }
      if (
        current.node.scroll.y + current.node.scroll.clientHeight >=
        current.node.scroll.height
      ) {
        report.reason = "page-read-observed-boundary-not-completeness";
        break;
      }
      if (report.contentBytes >= a.maxContentBytes) {
        report.reason = "page-read-content-budget";
        break;
      }
      const child = hash([a.operationId, digest, report.steps.length]).slice(
        0,
        64,
      );
      runtime.children.set(a.operationId, child);
      let receipt;
      try {
        guard();
        receipt = await runtime.act(
          {
            operationId: child,
            observationId: current.o.id,
            target: current.node.ref,
            kind: "scroll",
            dy: a.dy,
            intent: "scroll",
          },
          { valid, deadline },
        );
      } catch {
        receipt = {
          accepted: true,
          delivery: "unknown",
          outcome: "unknown",
          reason: "page-read-child-unconfirmed-no-retry",
        };
        if (session === runtime.session) runtime.fenced = true;
      } finally {
        runtime.children.delete(a.operationId);
        runtime.cancelled.delete(child);
      }
      report.steps.push({
        operationId: child,
        accepted: receipt.accepted,
        delivery: receipt.delivery,
        outcome: receipt.outcome,
        reason: receipt.reason,
        requestedDeltaY: a.dy,
      });
      if (receipt.delivery !== "synthetic-dispatched") {
        report.reason = receipt.reason;
        break;
      }
      guard();
      current = await capture();
      if (current.progress.deltaY <= 0) {
        report.reason = "page-read-no-downward-movement-not-end";
        break;
      }
    }
  } catch (e) {
    report.reason = e.message;
  }
  report.delivery = report.steps.some((s) => s.delivery === "unknown")
    ? "unknown"
    : report.steps.some((s) => s.delivery === "synthetic-dispatched")
      ? "synthetic-dispatched"
      : "not-sent";
  report.elapsedMs = Date.now() - started;
  try {
    await runtime.store.change((s) => {
      s.operations[a.operationId].receipt = report;
    });
  } catch {
    if (session === runtime.session && report.delivery !== "not-sent")
      runtime.fenced = true;
    throw Error("page-read-receipt-persistence-failed-no-retry");
  } finally {
    runtime.readingProgress.delete(a.operationId);
  }
  return structuredClone(report);
}
