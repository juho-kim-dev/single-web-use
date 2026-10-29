# Validation record · 0.5.0 increment

Environment: Windows, Node 24.22.1, locked Zod 4.6.7. Tests use temporary private state; no Nomiya installation/data or existing user browser profile is changed. No Actions runs, extension installation or real-site trial were performed. The supervisor published the reviewed0.2 checkpoint through PR2; implementation, local tests and live validation remain separate.

| Check | Actual result / meaning |
|---|---|
| Current0.4 source | Normal concurrent66/66 tests,0 failed/0 skipped; syntax/build passed. Earlier increment results below retain their original scope. |
| `npm run check` | JavaScript syntax checks across source, adapter, scripts and tests; not TypeScript/static semantic verification |
| `npm test` | Current0.3 source:59 pass/0 failed/0 skipped in the normal concurrent suite. The previous0.2 repair also passed independent43/43 and two simultaneous43/43 suites. Historical local counts are not independent verification; synthetic Chrome is not live verification |
| `npm run build` | Copies an installable unpacked manifest/module/popup tree into ignored `dist/extension`; connector runs from source |
| `npm audit` | Installed Zod updated from vulnerable initial selection to fixed 4.6.7; zero known reported vulnerabilities at check time |
| `npm pack --dry-run` | Verify allowlisted distribution contents; no private `.local`, runtime state, test profiles or node_modules |
| HTTP/CLI/MCP | Real loopback server and CLI/MCP subprocesses tested. Observation transport uses a simulated adapter; this is not live extension evidence |
| Synthetic Chromium | Installed Chrome launched headless with isolated temporary profile and local fixture only. No extension loaded. Range text exclusions, metadata split, synthetic fill, duplicate/mutation refusal checked |
| Worker race | Mocked Chrome/fetch: disconnect/missing binding/focus refusal before injection → not-sent with zero input; scripting invocation failure → unknown/no retry |

Tests cover strict schemas/references/permissions, draft conflicts, fresh revision/session locator tests, base/overlay separation, inherited selectors, named arguments, initial vs continuing conditions, two-step state changes, missing unrelated roles, pinned operation intent, cancellation/timeout/restart, parent/primitive ledger bounds, prototype IDs, immutable observations, concurrent disk edit and same-surface serialization.

0.2.0 adds `reading.test.js`: extract-specific filtered payloads, single/many/ambiguous/missing/truncated roles, descendant segment order and source evidence, same-observation pagination, byte refusal, observation history/diff compatibility, private save/restart/count/byte bounds, original-definition digest preservation, exact repeated-item URL selection, isolated draft selectors, deactivate, global→site overlay and explicit permission acknowledgement. Browser fixture now checks real DOM nested span→same-link composition and stable same-document refs. `editor.js` ordinary field composition is tested without a second store; foreground visual/extension interaction is still unverified.

Independent supervisor verification of earlier5ce8ee8 failed23/25 with readiness timeouts and after-test persistence rejections. This actual failure is preserved, not superseded by earlier local green runs. The repaired harness uses wall-clock readiness and drains requests/store before deleting state; the timeout test controls expiry after lease without changing production semantics. `supervisor-repairs.test.js` adds slow preparation/teardown,900-item pagination, exact read/context/draft revision pinning across activation/deactivation, truncated condition/duplicate target refusal, max-condition overlay creation and64-role×300-node context-size regressions. The supervisor independently verified cf385b8 (43/43) and merged PR2 as main0ace8e7 with [skip ci]; no CI or release was triggered.

## Source relationship evidence

Graphify local AST analysis is kept only in owned ignored versioned output: `.local/graphify/` for0.1.0 and `.local/graphify-020/` for0.2.0. Source SHA-256 lists are compared before/after; base commit and dirty tree are recorded. No vault, private capture or semantic LLM extraction is used; extraction tokens are zero. Raw extraction, directed graph, diagnostics, report and HTML are retained there. It is navigation evidence, not runtime proof. The0.2.0 graph has116 nodes/270 edges from13 source/extension JS files;13 same-endpoint relation variants collapse in the generated DiGraph (0 missing/dangling/self-loop edges). Consult raw edges for shared `contains`/`calls` endpoints. HTML visual inspection was not performed; heuristic token estimates are not a measured model/cost benchmark.

The repair successor uses `.local/graphify-repair/`:117 nodes/273 edges from the same13 source/extension files, source hashes equal before/after; base commit plus dirty state retained and final checkpoint annotated after commit.13 relation variants collapse, with0 missing/dangling/self-loop edges. Prior outputs are preserved; this still is not live-browser or pixel evidence.

The final0.3 AST graph in `.local/graphify-030/` covers15 source/extension files:140 nodes,339 edges,7 communities; source SHA-256 lists match before/after. Diagnostics identify16 same-endpoint relation variants and0 missing/dangling/self-loop edges. Raw extraction, report, HTML and base/dirty provenance are retained privately; final commit hashes are checked against that manifest. HTML was generated but not visually inspected. A package dry-run caught a generated source-tree analysis cache; the source allowlist was narrowed and the repeated inspection found0 private/cache files among68 distribution entries.

## Foreground/live gate for supervisor

1. Load `dist/extension` manually in actual Chrome/Chromium; record browser/OS/version, extension ID/version and permissions. Pair privately; confirm connector and popup status agree. Do not publish the token.
2. Test the local demo through the actual installed adapter. Verify concrete returned text vs viewport, synthetic fill/echo, duplicate/conflicting IDs, draft/test/activate/export/import and reconnect. Check keyboard focus, accessible labels and popup error handling visually.
3. Start a real-site trial from a bookmarked service home or Google home search. Observe concrete visible titles/links. Navigate read-only; do not post/send/purchase/delete or modify existing work/settings.
4. Test manual field change, scroll/resize, tab/focus change, navigation, worker restart and after-lease cancellation. Confirm stale/unknown cases produce no blind replay. Separate known not-sent from possible delivery and inspect before rebind.
5. Check site pack usefulness and omissions, not only JSON success. Unknown/partial content is not absence. Record failed/unsupported cases and restore only self-created tabs/state.

Until those steps are actually executed, the browser adapter remains implemented and locally checked, **not installed/live-verified**. Other browsers/OS and specific AI clients remain unverified even if the local protocol test passes.

## 0.3.0 authoring and review

The supervisor implemented the0.3 increment and executed its tests. A separate primary Codex CLI reviewed supplied source without executing tools; it did not independently run the59 tests. Its concrete findings led to regressions and fixes: session/fence recheck after durable input reservation, append intent including original expected revision and reconstructed verified historical receipts, captured UI selection/generation/content, records for observations excluded after an await, and explicit reload after a definite append conflict while uncertain replies retain their original identity. The CLI review is source review, not live browser certification.

New arrival tests cover exact source/destination contracts, same/new document, observed destination text, unexpected route, count and timeout bounds, cancellation/rebind, one input attempt and unchanged unknown-delivery fence. Document tests cover preserved sections, expected revisions, duplicate intent/conflicts, restart, context boundaries, byte/count rejection, integrity, escaped export and shared MCP routing. The actual popup module is loaded with simulated DOM/transport for race/conflict tests; this does not verify real extension visuals/accessibility.

Follow-up CLI review found selection/reopen identity loss and concurrent popup storage overwrite. The common worker now serializes persisted append intent and conflict reset. The actual worker/popup regression covers simultaneous distinct/same pairs, uncertain replies, selection/content changes and worker/popup restart. The final separate CLI source review confirmed these findings resolved and reported no new concrete defect in that supplied scope; it ran no tools/tests. The supervisor's final normal suite remained59/59 with0 skips, syntax/build passed and npm audit reported0 known vulnerabilities. Real MV3 lifecycle termination remains unverified.

## 0.4.0 control/lifecycle verification

`control-lifecycle.test.js` covers persisted pause/bind/restart, historical reads, queued work and fast resume, unleased/leased input, interrupted reads, disk failure, resolved-reply/retain races for observe and act.after, archive conflicts, original/pinned definition preservation and fresh validation after restore. `popup-lifecycle.test.js` loads the actual module with simulated controls/transport and checks that late lifecycle/load replies preserve unsaved JSON, ordinary fields and selection. These seven tests join the normal66/66 suite; none substitutes for actual extension UI or browser termination tests.

The separate primary CLI reviewed source only, identified the pause-boundary and editor-overwrite findings, and confirmed their fixes in follow-up source reviews. Supervisor check/test/build and package inspection passed. The0.4 package lists71 entries with0 private/cache files. Dependencies are unchanged from the0.3 audit with0 reported vulnerabilities; no separate new audit is implied.

Graphify0.9.95 AST output in ignored `.local/graphify-040/` covers the same15 source/extension files:147 nodes,357 edges,8 communities. Source SHA-256 values match before/after, base commit plus dirty provenance are retained and the final commit is checked against them. Diagnostics report19 same-endpoint relation variants,0 missing/dangling/self-loop edges. Report/HTML generated, visual inspection not performed. No personal source or semantic LLM extraction is included.

## Bounded container reading · initial restricted MXC results

Base/branch: published0.4 `80df6e7d8140bb2e415b451fbdb4d4b6e4d31525`, `codex/paw-swu-page-reading`. Primary CLI executed these checks in MXC workspace-write; this is separate from the previous source-only reviews.

- Workspace `.local` read/write and shell process probe succeeded. Default sandbox TEMP permitted creation but StateStore rename failed EPERM in all9 initial new tests. Only child-process TEMP/TMP were redirected to the already authorized ignored workspace `.local/test-temp`; no ACL, isolation, accounts, global config or production persistence behavior changed.
- Final normal concurrent `npm test`: **81 tests,78 passed,3 failed,0 skipped**. New pageRead/popup tests: **15 passed,0 failed,0 skipped**. Failures remain synthetic Chrome exit2147483651, real CLI status subprocess exit1, and authenticated HTTP transport fetch connect EACCES on loopback. No failed test was skipped, serialized or retried to manufacture green. The CLI subprocess assertion alone does not expose its cause; loopback failure is independently explicit. Supervisor must validate these paths outside this restricted invocation.
- `npm run check` and `npm run build` passed on final source. Existing readonly installed Prettier formatted only explicit owned JS/JSON/HTML files. The synthetic Chrome self-check gained metric/stale-offset assertions but could not execute successfully here; it is not collector/live proof.
- Graphify local AST covered16 `src/*.js` and `extension/*.js` files in ignored `.local/graphify-page-reading`:150 nodes,372 directed edges,8 communities; source SHA-256 unchanged before/after extraction, base commit and dirty state recorded. Diagnostics:20 same-endpoint relation variants,0 missing/dangling/self-loop edges. Graph JSON/report generated; no visual/semantic/private-corpus extraction or measured performance claim.
- Package dry-run/owned-file hashes are saved privately for supervisor handoff. No remote writes, Actions, account/auth changes, browser installation, foreground/live-site trial or permission expansion occurred.

At this initial MXC checkpoint, full validation had not passed and no version promotion/local delivery commit was made. The later supervisor verification below supplies the separate successful integration evidence; the original failures remain recorded. The Computer Use stop was not bypassed with another UI route, CDP, hidden profile or shell navigation. Synthetic headless Chrome was attempted only by the pre-existing test and failed; no product browser was controlled.


## 0.5.0 supervisor verification and finalization

The supervisor tested an exact hash-confirmed copy of the implementation after the restricted MXC handoff. Its normal concurrent `npm test` passed **81/81,0fail,0skip**; `npm run check` and `npm run build` passed. The primary CLI inspected the supplied check/test logs and compared the supervisor SHA-256 manifest for all74files with its own tree before finalization. Every src/extension/test file matches; none is omitted from the manifest. Six documentation/example differences were found: README.md, README.ko.md, docs/review.md, docs/validation.md, docs/page-reading.md and examples/page-read.json. The example now pins the unchanged synthetic pack's actual canonical hashes, not placeholder hashes.

The finalization updates only version literals in CLI/runtime/MCP/manifest/popup footer and package/lock metadata to0.5.0, plus public status documentation. No implementation or test behavior differs from the supervisor-verified source. The primary CLI runs syntax/build and focused version/MCP/example-hash checks on final metadata. It does not repeat known unavailable MXC loopback/Chrome checks or claim its own81/81 execution. Full success is supervisor evidence;78/81 is the separately retained restricted-environment result.

Final source hashes, manifest comparisons, package allowlist inspection and Graphify AST provenance remain in ignored local evidence. No private validation paths, conversations, captures or logs are packaged. At this checkpoint Browser Computer Use was stopped pending a human opening Google home; no installed extension, foreground/live-site or native-input verification is implied. Remote writes/CI/releases remain supervisor-owned and were not performed by this worker.


## Review adjustment before final supervisor execution

After the supervisor's81/81 pass, the existing synthetic Chrome fixture gained a successful real `pageCommand` scroll path: fresh observation and current container target, a unique operation ID, synthetic-dispatched receipt, increased actual scrollTop, and a subsequent observation whose measured y equals that scrollTop. Existing exclusions, fill, duplicate, mutation, focus and stale-offset checks remain. No new browser route/profile mechanism or user UI access was added.

At this handoff, the earlier81/81 result predated the added assertion and final execution was still pending. The later final gate below supersedes that pending state. The primary CLI runs syntax/build and network-free checks only; it does not rerun the known-unavailable MXC Chrome/loopback tests. Runtime/extension implementation is unchanged from the verified source; the additional test is the sole post-verification test-logic difference. Legacy inventory current rows now state pageRead/operation/cancel bounded counterparts and preserve pause/archive/restore partial-contract distinctions. Installed/live evidence remains absent.

Final adjusted-source checks by the primary CLI: `npm run check`, `npm run build`, version/runtime/MCP/CLI/example-pin checks passed; network-free pageRead/popup regressions passed15/15 with0fail/0skip. These do not execute the new browser assertion. Package dry-run remains78 allowlisted files with0 private/cache/workflow entries. Exact owned hashes are refreshed for supervisor handoff; no staging/commit was attempted in this final review turn.


## Final independent gate · 2026-10-29 · 0.5.0

After exclusive handoff from the primary CLI, the supervisor ran the final source with normal concurrent npm test: **81 passed, 0 failed, 0 skipped**, including the newly added successful synthetic element scroll, actual scrollTop displacement and subsequent observed offset assertion in installed headless Chrome. npm run check, npm run build and git diff --check passed. The HTTP authentication/transport and real CLI/MCP subprocess checks also passed. This supersedes the earlier pending-assertion status; restricted MXC results remain separate historical evidence. No runtime logic changed after this final execution; only review/validation status prose was updated.

After the user reported opening Google home, the same Windows Computer Use path was retried. The returned Chrome window still had a new-tab title, and capture again stopped because the tool could not establish the current browser URL confidently. No input was sent. Whether the user-opened page and the returned window were the same was not established. No alternate UI route was used to evade the stop. This is a browser-tool blocker, separate from GitHub access and source checks. Extension loading/pairing, foreground behavior, real-site usefulness and native input remain unverified; synthetic tests are not substitutes.

## Connection diagnostics patch · restricted worker checks

On branch codex/swu-connection-diagnostics, base3b4ec9fb822a05f97e93d74be507c30c06a62bee, the primary CLI ran `npm run check`, `npm run build` and the normal concurrent selection of worker/connection-diagnostics/popup regression files: **8 passed,0 failed,0 skipped**. These tests load the actual extension modules with simulated Chrome APIs and fetch; they do not call a live browser, MCP server or running runtime. Cases distinguish12 precondition refusals, zero bind traffic/script execution before refusal, rejected bind transport cleanup and explicit recovery, overlapping connection attempts, disconnect during foreground wait, unchanged control guards, post-injection focus-loss unknown delivery, and actual popup-handler code/guidance display.

The full suite and synthetic Chrome/loopback integrations were not rerun in the known-restricted MXC environment. Previous81-test delivery results remain historical evidence for the prior source, not a pass of this patch. The supervisor must run final full checks, review the exact hashes and refresh an installed build separately. Source/package versions remain0.5.0. The reported Google-foreground refusal still has no confirmed predicate-specific live result; neither a URL-unavailable cause nor a focus cause is inferred from the old combined error. No auto-focus/navigation, hidden-tab bind, profile/config/state inspection, permission/auth change, runtime restart, extension installation or alternative UI route was performed.


## Connection diagnostics · supervisor gate · 2026-10-29

After CLI handoff, the supervisor reproduced and fixed cancellation during tab query using the existing invalidation epoch. Normal concurrent full suite: **85 passed,0 failed,0 skipped**; check and build pass. Includes HTTP/CLI/MCP/synthetic Chrome integrations and the adjusted worker/popup regressions. Source metadata stays0.5.0; this is a reviewed repair commit, not a new release.

The installed development folder was updated with all8 built extension files and SHA-256 copy equality. Chrome reload and the actual predicate-specific result are separate pending user actions. An authenticated runtime and a successful Codex MCP status call are confirmed; browser status remains unbound in the last check. No fabricated binding or reduced focus requirement was used, and no live observation/read/scroll success is asserted.
