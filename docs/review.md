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

## 0.2.0 increment review · base5ce8ee8 · 2026-10-29

What this change does: It makes bounded role-based reading and manipulation independently usable through the existing connector. It adds same-observation pages, history/diff, explicit private saved reading, capability discovery and ordinary personal-ability authoring without replacing shared originals.

Scope reviewed: contracts/reading/runtime/packs/store, collector/worker/editor/popup, MCP/CLI discovery, examples and connected tests/docs. One local runtime/user with multiple clients remains the expected load. Source is formatted with the already-installed formatter on an explicit owned file list; no Nomiya/tool installation was changed.

Findings fixed before handoff:

1. Link containers lost nested titles because only nearest leaf text was retained. Collector now emits ordered bounded text segments with stable element refs; composition follows only observed parent chains. Each href stays on the same role node, with no metadata or nearby-title substitution. Actual synthetic Chromium and per-card pagination tests cover this.
2. Returning all projected many-item evidence before applying pagination could multiply work/payload. Read selection now stores small descriptors and projects only the requested page. Context extraction previews ten items/role with a continuation; locator tests persist only validation metadata rather than automatic text archives.
3. Retained observation read originally depended on current binding. Historical reads now use a separate detached-copy path; live act still requires current session. Diff rejects incompatible document/session/generation/URL/surface and never calls disappearance deletion. Private saved pages have explicit count/byte bounds and survive restart without restoring input refs.
4. Inactive drafts could poison ordinary reads. Normal observation now uses only active effective selectors; packTest alone adds the selected draft's selectors. Deactivation preserves revision/history. Regression verifies these boundaries.
5. A read-only shared base incorrectly forbade new personal action permissions and global→site narrowing. Scope remains constrained; preview/test enumerate additions, activation requires explicit acknowledgement, and the original base stays pinned/unchanged. Ordinary author fields create only unsaved drafts; saved exact revisions remain the test/activate boundary.
6. All adapter errors were marked unknown. A phase flag now returns not-sent only before scripting invocation; any possible execution remains unknown. Missing binding/focus and post-invocation failure have separate mocked regressions. No focus takeover was added.
7. New role defaults could silently change an old shared definition's exported digest. New fields stay optional with interpretation defaults; export preserves the original stored body, and export/import of the old canonical shape retains its hash. Regression covers this preservation.

The implementation reuses one StateStore, strict schemas, Node primitives and existing API paths. No new service/registry/updater/debugger permission/monitor was added. No safe further deletion was found that preserves requested reading, lifecycle and uncertainty boundaries.

Verdict: Ship the formatted **local increment for independent supervisor review**, not a public release or live-browser certification.

Not checked: foreground installed extension and author UI visual/accessibility behavior, actual sites/AI clients, non-Windows support and unavailable Sakaba/gen3 bodies. Native pointer/keys/hover/wheel routing, arrival waiting, accumulated PageDocument, fingerprint migration and render research remain concrete missing API families in legacy-parity.md.
