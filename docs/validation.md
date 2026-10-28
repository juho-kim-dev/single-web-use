# Validation record · 0.3.0 increment

Environment: Windows, Node 24.22.1, locked Zod 4.6.7. Tests use temporary private state; no Nomiya installation/data or existing user browser profile is changed. No Actions runs, extension installation or real-site trial were performed. The supervisor published the reviewed0.2 checkpoint through PR2; implementation, local tests and live validation remain separate.

| Check | Actual result / meaning |
|---|---|
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
