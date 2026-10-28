# Validation record · 0.2.0 increment

Environment: Windows, Node 24.22.1, locked Zod 4.6.7. Tests use temporary private state; no Nomiya installation/data or existing user browser profile is changed. No Actions runs, remote writes, extension installation or real-site trial was performed by this worker.

| Check | Actual result / meaning |
|---|---|
| `npm run check` | JavaScript syntax checks across source, adapter, scripts and tests; not TypeScript/static semantic verification |
| `npm test` | 0.1.0 checkpoint:25 pass; 0.2.0 increment:36 pass/0 failed/0 skipped at final review; synthetic Chrome is not live verification |
| `npm run build` | Copies an installable unpacked manifest/module/popup tree into ignored `dist/extension`; connector runs from source |
| `npm audit` | Installed Zod updated from vulnerable initial selection to fixed 4.6.7; zero known reported vulnerabilities at check time |
| `npm pack --dry-run` | Verify allowlisted distribution contents; no private `.local`, runtime state, test profiles or node_modules |
| HTTP/CLI/MCP | Real loopback server and CLI/MCP subprocesses tested. Observation transport uses a simulated adapter; this is not live extension evidence |
| Synthetic Chromium | Installed Chrome launched headless with isolated temporary profile and local fixture only. No extension loaded. Range text exclusions, metadata split, synthetic fill, duplicate/mutation refusal checked |
| Worker race | Mocked Chrome/fetch: disconnect/missing binding/focus refusal before injection → not-sent with zero input; scripting invocation failure → unknown/no retry |

Tests cover strict schemas/references/permissions, draft conflicts, fresh revision/session locator tests, base/overlay separation, inherited selectors, named arguments, initial vs continuing conditions, two-step state changes, missing unrelated roles, pinned operation intent, cancellation/timeout/restart, parent/primitive ledger bounds, prototype IDs, immutable observations, concurrent disk edit and same-surface serialization.

0.2.0 adds `reading.test.js`: extract-specific filtered payloads, single/many/ambiguous/missing/truncated roles, descendant segment order and source evidence, same-observation pagination, byte refusal, observation history/diff compatibility, private save/restart/count/byte bounds, original-definition digest preservation, exact repeated-item URL selection, isolated draft selectors, deactivate, global→site overlay and explicit permission acknowledgement. Browser fixture now checks real DOM nested span→same-link composition and stable same-document refs. `editor.js` ordinary field composition is tested without a second store; foreground visual/extension interaction is still unverified.

## Source relationship evidence

Graphify local AST analysis is kept only in owned ignored versioned output: `.local/graphify/` for0.1.0 and `.local/graphify-020/` for0.2.0. Source SHA-256 lists are compared before/after; base commit and dirty tree are recorded. No vault, private capture or semantic LLM extraction is used; extraction tokens are zero. Raw extraction, directed graph, diagnostics, report and HTML are retained there. It is navigation evidence, not runtime proof. The0.2.0 graph has116 nodes/270 edges from13 source/extension JS files;13 same-endpoint relation variants collapse in the generated DiGraph (0 missing/dangling/self-loop edges). Consult raw edges for shared `contains`/`calls` endpoints. HTML visual inspection was not performed; heuristic token estimates are not a measured model/cost benchmark.

## Foreground/live gate for supervisor

1. Load `dist/extension` manually in actual Chrome/Chromium; record browser/OS/version, extension ID/version and permissions. Pair privately; confirm connector and popup status agree. Do not publish the token.
2. Test the local demo through the actual installed adapter. Verify concrete returned text vs viewport, synthetic fill/echo, duplicate/conflicting IDs, draft/test/activate/export/import and reconnect. Check keyboard focus, accessible labels and popup error handling visually.
3. Start a real-site trial from a bookmarked service home or Google home search. Observe concrete visible titles/links. Navigate read-only; do not post/send/purchase/delete or modify existing work/settings.
4. Test manual field change, scroll/resize, tab/focus change, navigation, worker restart and after-lease cancellation. Confirm stale/unknown cases produce no blind replay. Separate known not-sent from possible delivery and inspect before rebind.
5. Check site pack usefulness and omissions, not only JSON success. Unknown/partial content is not absence. Record failed/unsupported cases and restore only self-created tabs/state.

Until those steps are actually executed, the browser adapter remains implemented and locally checked, **not installed/live-verified**. Other browsers/OS and specific AI clients remain unverified even if the local protocol test passes.
