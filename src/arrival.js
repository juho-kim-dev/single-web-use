import { checkConditions, resolveRoles } from "./packs.js";

export function navigationDestination(source, href) {
  const from = new URL(source.url),
    to = new URL(href);
  if (
    !/^https?:$/.test(to.protocol) ||
    to.username ||
    to.password ||
    to.href !== href ||
    to.origin !== from.origin ||
    to.href === from.href
  )
    throw Error("arrival-requires-exact-different-same-origin-link");
  return to.href;
}

// One preceding click only; this routine can read but cannot deliver or retry input.
export async function observeArrival(
  runtime,
  { source, destination, pack, rule, operationId },
) {
  const started = Date.now(),
    deadline = started + rule.maxElapsedMs,
    checks = [];
  let status = "unconfirmed",
    reason = "arrival-observation-budget";
  const guard = () => {
    if (runtime.cancelled.has(operationId)) throw Error("arrival-cancelled");
    if (
      runtime.session !== source.session ||
      String(runtime.binding?.tabId) !== source.surfaceId
    )
      throw Error("arrival-binding-changed");
    if (Date.now() >= deadline) throw Error("arrival-time-budget");
  };
  try {
    for (let i = 0; i < rule.maxObservations; i++) {
      guard();
      const o = await runtime.observe(
        pack.roles.map((r) => r.locator.selector),
        deadline - Date.now(),
        operationId,
      );
      const check = {
        observationId: o.id,
        documentId: o.documentId,
        url: o.url,
        at: o.at,
        result: "received-not-assessed",
      };
      checks.push(check);
      try {
        guard();
        if (
          o.documentId === source.documentId &&
          o.userEpoch !== source.userEpoch
        )
          throw Error("arrival-user-intervention");
      } catch (e) {
        check.result = "excluded-after-observation";
        check.excludedReason = e.message;
        throw e;
      }
      check.result = "waiting-for-destination";
      if (o.url !== destination && o.url !== source.url) {
        status = "unexpected-destination";
        reason = "arrival-unexpected-destination";
        break;
      }
      if (o.url === destination) {
        check.conditions = checkConditions(
          rule.conditions,
          resolveRoles(pack, o),
        );
        check.result = check.conditions.every((c) => c.result === "observed")
          ? "destination-conditions-observed"
          : "destination-conditions-unconfirmed";
        if (check.result === "destination-conditions-observed") {
          status = "arrived";
          reason = "arrival-observed-not-causation";
          break;
        }
      }
      if (i + 1 < rule.maxObservations)
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.max(0, Math.min(100, deadline - Date.now())),
          ),
        );
    }
  } catch (e) {
    reason = e.message;
    status = /time-budget|bridge-timeout/.test(reason)
      ? "unconfirmed"
      : "interrupted";
  }
  return {
    status,
    reason,
    checks,
    elapsedMs: Date.now() - started,
    destination,
    inputPermission: false,
    meaning:
      "read-only-after-one-attempt; no-input-retry-or-causation; delivery-and-fence-unchanged",
  };
}
