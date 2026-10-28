# Ponytail review · 0.1.0 local checkpoint

What this change does: It connects one open foreground browser tab to a single local runtime, CLI and MCP entry point. Users can author versioned site abilities and run guarded synthetic actions with durable receipts.

Scope: all new `src/`, `extension/`, `scripts/`, `test/`, example and setup/documentation changes from base `906d9e3`. Expected load: one local user, one browser binding, several CLI/MCP/editor clients; serialized surface actions, bounded observations/queue/ledger. Review followed callers from schema → CLI/MCP/HTTP → Runtime/Packs/StateStore → worker/page and back to evidence. It is an implementation review, not independent supervisor sign-off or live-site approval.

## Findings fixed before checkpoint

1. **Container text included content outside the viewport.** The initial collector read whole innerText and used it as labels. Replaced with bounded codepoint Range/ancestor-clip acquisition, sensitive/hidden/unsupported omission and separate metadata labels. Synthetic Chromium regression checks concrete exclusions; pixel and paint correctness remain unverified.
2. **Later procedure steps repeated initial preconditions and required unrelated roles.** Separated initial preconditions, continuing scope, current target and final postconditions. Two-step fill regression and unrelated missing role now pass. Added bounded named arguments; ledger binds exact arguments and pinned active/effective revisions.
3. **Overlays could not reference inherited roles.** References validate after pinned-base composition; inherited selectors reach observations. Scope/permission widening is rejected and base updates leave overlays pinned. Regression covers all three boundaries.
4. **Parent ledger/cancellation and prototype keys lacked matching bounds.** Parents and primitives share reserve checks; public IDs reject prototype names; cancellation exists only for bounded in-flight work, propagates to the child and prevents later steps. Leased cancellation remains unknown and fenced. Regressions cover full ledger, duplicate IDs, cancellation cleanup and worker await/disconnect race.
5. **State preparation could overwrite an edit made after the first digest check.** Recheck after synced temporary write immediately before rename, clean temporary files on all failures, preserve current memory/editor draft on detected conflict. Residual non-atomic CAS boundary documented: a single owner and no external editors remain required.
6. **Focus handlers could change a protected field before fill.** Recheck current value/document/mutations immediately after focus, with unknown partial-focus delivery and no text write on changed state. Synthetic browser regression verifies the changed value is preserved.
7. **A child receipt save failure could lose delivery evidence in its parent.** Persistence failure now fences primitive input; the parent retains unknown child delivery rather than reporting not-sent. Regression injects the failed save after dispatch.
8. **An overlay could replace a base role used by a continuing scope condition.** This would keep the condition's ID while changing what it tests. Such role replacement is now rejected. Unsupported null field values also stay unknown; both boundaries have regressions.

## Simplicity decisions

Reuse standard Node HTTP/crypto/filesystem/readline/test APIs and one Zod dependency. No database/service framework, arbitrary eval, plugin registry, background scheduler, native-host installer or duplicated UI store. No safe further deletion was found that preserved the required boundaries. Source formatting uses an already-installed formatter without modifying that installation.

Verdict: Ship the **local review checkpoint to the supervisor**. This is not a release or live-browser approval.

Not checked: actual installed extension, foreground editor accessibility/visual QA, real sites, specific AI clients, non-Windows platforms, pixel/occlusion proof, crash/power-loss guarantees and inaccessible Sakaba/gen3 source. See requirements for exact remaining scope.
