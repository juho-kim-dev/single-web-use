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

## Independent supervisor failure and repair · base c7ff956 · 2026-10-29

The supervisor's fresh checkout of exact `5ce8ee8` passed npm ci/check but its first normal concurrent npm test failed:25 total,23 passed,2 failed,0 skipped. The child receipt-save regression and cancel/timeout regression hit `expected-pending-command`, then emitted asynchronous persistence errors after test completion. Build was not run in that independent attempt. This is preserved as a known-failing DRAFT checkpoint result, not overwritten by earlier local green runs; only that earlier checkpoint was published to draft PR2, without main/CI/release integration.

Root cause: the harness waited only30 zero-delay ticks while fsync/concurrent Chrome/CLI preparation could take longer. It also allowed live promises to outlast temporary-state deletion. The repair uses a5-second wall-clock readiness predicate; timeout tests lease the actual command before advancing a test clock through its real callback. Fixture teardown blocks new commands, disconnects, settles tracked requests/runtime/store queues, then removes temporary files. A slow120ms preparation + unawaited-request cleanup regression proves the old wait/teardown ordering is replaced. Production Runtime timeout/no-retry semantics are unchanged. The ordinary concurrent suite passes, plus two complete suites run simultaneously under additional ordinary load, each43/43 with no skip or late unhandled rejection.

Connected boundary repairs reviewed across read/assess/packTest/context/conditions/runPack/capabilities/editor:

- Offset already reached6400 in c7ff956; a new900-item test proves returned continuations beyond300 remain valid.
- Read and all context/draft extraction continuations now pin exact stored revision/effective hash. Update/deactivation cannot silently substitute an active definition; historical refs still confer no input authority.
- Conditions require one actual observed candidate with no known truncation; many/limit1 with a second differently enabled/value/text candidate remains unknown. Known duplicate hrefs beyond limit also block input; discovery reports the same search-truncated reason.
- Public assess/context/test responses carry bounded summaries/ref samples rather than repeated raw nodes or inline extracted bodies. Context adds count/byte pages, explicit over-budget refusal, coverage and exact-revision read/raw-evidence routes. The64-role×300-node ambiguous multiplication has a direct size/shape regression.
- Popup overlay creation uses the tested editor helper with empty overlay-owned conditions; all8 base predicates survive composition exactly once. Originals, permission acknowledgement and global→site restrictions remain intact.

Verdict: hand off the repaired local commit for exact independent revalidation. This does not mark the overall SWU request, browser installation, live sites or missing legacy families complete. No new service, production timeout policy, permission expansion, arbitrary eval or ancestor innerText path was added.

## 0.3.0 Ponytail and separate CLI review

Base: published0ace8e7. Connected scope: optional pack arrival contract → Runtime/arrival → existing worker observation/durable receipt paths; StateStore/ReadingDocuments → strict APIs/CLI/MCP → ordinary editor and document controls; examples, tests, docs and92-command inventory. One owned local runtime remains the load model. No new dependency, service, browser permission, scheduler or original-vault write was added.

The separate primary CLI reviewed provided code only because its restricted Windows command helper could not start. The supervisor implemented the code, ran the normal test suite and fixed all findings; CLI source review and supervisor execution are distinct evidence.

1. Session could change while the input reservation was persisted. Recheck session/fence immediately before command creation; a stalled-reservation/rebind test proves zero commands to the new binding and a durable not-sent receipt.
2. Append retry did not bind expected revision, and stored receipts escaped integrity coverage. Bind original expected and reconstruct the historical summary from hash-covered section prefixes; remove duplicate stored receipts. Changed intent and corruption regressions preserve existing content.
3. Late UI loads could target a different selected document. Capture ID/content/generation before awaits and reject obsolete results. Actual popup-handler tests simulate reversed responses and selection changes.
4. Observations received at a deadline/interruption boundary disappeared from arrival evidence. Record their source identifiers first, then mark exclusion without treating them as arrival or input authority.
5. Definite append conflicts kept a stale request forever. An explicit successful reload may reset only a definitely rejected request. Unknown replies preserve their original identity/expected; both paths are tested.
6. Switching documents/content or reopening the popup discarded uncertain append intent. Persist each document/content request before dispatch in extension-local storage; selection changes never clear it. Explicit reload clears only definite conflicts with no pending send. Regression covers selection/content changes and popup reopen. The bounded retry table refuses overflow instead of silently evicting identities.
7. Separate popup copies could overwrite another window's persisted request table. Move intent creation/persistence/send and definite-conflict reload into one serialized extension-worker path. Actual worker + popup regression covers concurrent different/same pairs, selection/content changes and worker/popup restart without identity loss. The popup no longer owns a duplicate retry store.
8. Package dry-run included Graphify's generated source-tree cache despite a root ignore file. Restrict the source package allowlist to runtime JavaScript and ignore generated graph directories in Git. The repeated package inspection contains no analysis cache or private `.local` data; no cache was published.

The minimum complete change reuses existing pack/schema/StateStore/connector paths, bounded pagination, conditions and Node primitives. Document sections preserve overlap instead of inventing a correspondence engine. Export reuses checksums and escaped strings rather than adding an archive dependency. Missing legacy functionality remains explicit in the92-command inventory; no numeric completion percentage is inferred.

Limits: source/local tests only; installed extension, real sites, native input/paint, accessibility, client/other-OS adoption and inaccessible historical originals remain unverified. Optional export is a capability, not a new prerequisite for SWU use.

## 0.4.0 Ponytail and separate CLI review

Base: published deecb7e. Scope: strict pause/lifecycle APIs → runtime control/store/packs → CLI/MCP discovery and popup → seven new regression tests, contract/requirements/parity docs. Load remains one runtime and shared extension worker with concurrent clients. No new package, service, permission, installer or original-data conversion.

The primary CLI reviewed supplied public source without executing tools. The supervisor implemented and ran tests. Two concrete findings were fixed and re-reviewed:

1. A reply resolved immediately before pause could be retained afterward and escape input invalidation. Capture request pauseEpoch in observe/act and pass it to retain; preserve late results as historical evidence while marking input refs invalid. Both observe and act.after have exact reply-then-pause regressions. Eviction also removes obsolete invalidation entries.
2. Archive/restore replies could overwrite edits made while awaiting a response. Capture editor selection, revision, JSON and ordinary field values; compare after lifecycle and load awaits before applying. Preserve changed editor state and display the server result separately. Actual popup-module tests cover JSON, fields and selected-pack changes.

The final CLI source review confirmed those findings resolved and reported no further concrete defect in the supplied changed scope. Normal supervisor tests pass66/66 with0 skipped; check/build and package privacy inspection pass. Runtime pause reuses existing cancel/receipts and StateStore; restoration reuses preserved revisions instead of copying files or introducing another history engine. Archived bases remain available to pinned overlays, stated in UI/contracts. No safe further deletion was identified that preserves requested behavior and validation boundaries.

Unverified: installed extension and actual MV3/OS process lifecycle, foreground visual/accessibility behavior, real websites, native input release and all historical-source parity. Storage failure keeps current memory paused but cannot promise restart persistence; this boundary is explicit.

## Bounded container reading · Ponytail full review

What this change does: one input-capable pageRead request pins an active site/effective definition, observes selected within-container reading, then uses existing guarded synthetic scroll under finite budgets. Operation/cancel expose bounded progress and durable idempotent receipts, without an automatic second content store. Review load assumption: one runtime with concurrent CLI/MCP/popup clients; the same-surface queue and existing64-in-flight limit remain authoritative.

Connected review: contracts → runtime dispatch/inFlight/pause/cancel → new page-reading orchestrator → existing read/role resolution/act/worker/page collector → MCP/CLI/ordinary popup → examples/docs/tests. pack schema canonical fields are unchanged. New optional scroll metrics do not inject defaults into old observations or definitions. Stored definitions are never current-input authority.

Fixed during self-review:

1. A mutable progress report initially shared the parent journal's pending receipt object. Clone at reservation so unsaved progress cannot mutate StateStore; regression checks the journal remains pending/empty while live progress has a capture, plus restarted pending returns unknown without commands.
2. Existing observationDiff did not name the new scroll metric changes. Add that field and assert compatible before/after observations expose the metric difference without deletion/currentness inference.

Reviewed boundary tests include multiple accepted captures, own within-root selection, no raw-content ledger multiplication, URL/document/generation/viewport/user/session mismatch, missing/ambiguous/truncated scroll roles, unknown metrics, unchanged offsets, zero-step/content/time budgets, parent/child reservation interruption, unleased/leased cancellation and leased pause/fence, exact reply/pause races, same-ID conflicting intent, restart, pinned definitions after activation change/deactivation, final receipt-save failure and real popup-module request/late-field behavior. Existing canonical pack/overlay/control tests pass in the normal suite. No new service/dependency/updater/native permission was introduced.

Initial verdict: hold version promotion while the restricted MXC suite remained78/81 with0 skips. Supervisor subsequently checked a hash-matched implementation in a separate environment: normal concurrent tests81/81,0fail/0skip, check/build pass. Finalization compares all src/extension/test files with that manifest before changes: no code/test divergence or missing manifest entries. Six documentation/example files differ: README.md, README.ko.md, docs/review.md, docs/validation.md, docs/page-reading.md and examples/page-read.json. The finalization changes executable files only for version strings (CLI/runtime/MCP, manifest and popup footer), plus package/lock versions; no implementation/test logic changes.

Final Ponytail verdict: source checkpoint ready for supervisor publication review after local syntax/build/version checks; installed/live evidence remains absent. Existing pending/unknown fences, canonical pack schemas and source-only boundaries remain intact. No new dependency, service, permission or general abstraction is added. A0.5.0 development version is not a release or all-sites claim.

Not checked: actual installed extension, MV3 termination, popup visuals/accessibility, real-site usefulness, native wheel/keys/release or cross-platform/client adoption. Capture routes remain subject to existing memory retention and expire at restart; only explicit saved content/documents persist text. Time guards bound further input/acceptance, not disk completion or rollback of an in-flight dispatch. Whole-page reading remains not-established. No further concrete self-review finding remains in the scoped source, but a separate supervisor review is still required.


## Final supervisor review adjustment

The synthetic fixture previously proved metric collection and stale-offset refusal, but not successful scroll delivery. Extend that same fixture with a fresh target/unique ID and actual displacement plus post-scroll measured-y assertions. Exclusion/fill/stale checks remain intact. This is a test-only change; production behavior is unchanged. The supervisor's prior81/81 pass predates this assertion, so final full-suite execution is pending supervisor review. Local syntax/build/network-free checks cannot substitute for that run.

Correct the main92-command inventory pageReadStart/Status/Cancel rows to bounded0.5 counterparts and label pause/archive/restore implemented partial0.4 contracts. Current Korean parity summary distinguishes0.5 responsibilities from explicitly historical sections and remaining native/whole-page/live gaps. No further feature scope or new browser route is added. Verdict: hand off exact unstaged files for supervisor final test/review/commit; do not interpret earlier81/81 as a pass of the new assertion.


## Supervisor final review · 2026-10-29 · 0.5.0

Reviewed the new page-reading driver with connected runtime serialization, reservation/cancellation/pause, retained reading routes, collector/action scroll guards, strict API/MCP contracts, ordinary popup handlers and tests. Reused existing observation/read/act/store/operation paths without a new service or content archive. The two final findings were a missing successful browser scroll assertion and stale current-status inventory rows; both were corrected by the primary CLI. Supervisor reran the adjusted final suite:81/81 pass,0fail,0skip, including actual synthetic displacement and measured offset. Check/build/diff whitespace gates pass. No additional concrete correctness finding or justified simplification remains in this scoped review. Review scope and source hashes are retained in ignored local evidence; original private discussions are not published.

This passes source delivery review only. It does not establish full legacy parity, installed extension usability, live-site success, native input, or browser-tool recovery. Capture routes still expire with memory retention/restart, unknown delivery remains fenced, and whole-page reading stays not-established.
