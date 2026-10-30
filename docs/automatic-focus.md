# Automatic target activation · 2026-10-30

User request: finish PAW SWU automatic focus, then verify real-site reading, scrolling, preservation and read-back. This is the independent PAW product, not Nomiya issues40/42. Base main1ea412c; common PAW main c831be80249192d2acbeaa01ad0b0b488a970569. Owner: Windows Codex, isolated codex/swu-auto-focus worktree. No overlapping open PR was found.

## Behavior

A leased live observation/input command checks its bound tab/window and HTTP(S) address before requesting activation. It restores a minimized window, activates the existing bound tab, focuses that window, then rechecks. Session/binding/deadline checks run between awaits. No tab creation, automatic rebind, pause/resume, permission expansion or retry is added. Status polling, retained reads and saved content operations never activate.

Activation clears old Chrome-document input references, including when Chrome focus events are delayed. A fresh observation can establish new evidence. An action based on pre-switch evidence is refused as not-sent; it is never transparently retargeted or replayed. If focus/ownership changes after possible script execution, existing unknown-delivery handling remains. Browser activation is not proof of unobscured pixels or native/trusted input.

The panel distinguishes an owned background target from a disconnected target only for inactive/unfocused/minimized diagnostics. Moved/missing/unsupported targets still require inspection. Activation API exceptions use fixed codes rather than exposing browser exception details.

## Checks and review

- Whole suite:122/122 passed,0 skipped; syntax and build passed. This includes the existing synthetic Chrome, storage, lifecycle, transport and MCP tests, not installed real-site results.
- New worker regressions: inactive+minimized activation; already-ready no-op; activation failure; disconnect during activation; expired deadline; moved-window refusal; invalidation of a previously captured action reference; post-injection focus loss without recovery/replay. Passive panel/content-read requests make no activation calls.
- Panel review found a possible misleading connected-background display for moved/unsupported targets. Restricted it to the three focus diagnostics and passed all3 panel tests after that final edit; rebuilt. Source semantics outside this panel correction are the full-suite-tested bytes.
- Initial new test expected the bare refusal reason but the existing receipt includes adapter-pre-dispatch-refusal. Corrected the assertion, preserving the product contract; subsequent targeted and full suites passed.
- Ponytail review covered foreground/activateTarget/execute callers, lifecycle invalidation, Runtime.command/act pause/fence and the page's immediate target guard, panel status and tests. No dependencies, schema, store writers, permission or connector protocol changes. Remaining acceptance is installed/live evidence; no claim of solving every OS focus race.

## Preservation and installation preparation

The existing Connector was not listening. Its lock named a PID that no longer existed; port47831 had no listener. Preserved the stale lock rather than deleting it, then used the normal startup command. Status:0.6.1, disconnected, no binding/session, paused=false, fenced=false, observations=0. No previous state.json existed in the configured default private directory at this inspection. This is not proof about data in other profiles/directories.

Privately preserved connector.json and the previous installable extension artifact under the user's private backup directory; verified configuration SHA256 equality. Existing configuration, extension identity, pairing values and permissions are unchanged. No old state or browser storage was cleared. Updated only the existing dist/extension artifact and compared file hashes against the tested build. Chrome reloading that artifact is a separate step; copying files does not prove loaded code.

Browser extension storage and its drafts have not been independently backed up/restored: this change does not migrate or clear them. No storage-format conversion is introduced. Do not claim whole-browser or whole-app recovery from a source checkout or this artifact/config backup.

## Live acceptance status

A new Chrome test tab successfully opened Google home through the supported browser connector; existing user tabs were left in place. Attempting to inspect/reload the existing extension at chrome://extensions was blocked by the browser tool's URL policy. No alternate surface/CDP/command was used to bypass it. User was asked to reload the existing SWU extension and connect the Google test tab; waiting for that prerequisite.

Pending: loaded build identity, unfocused/minimized/inactive-target activation in actual Chrome; real-site read/scroll/useful content; explicit save/read-back integrity; passive retained/saved reads while another window is focused; preservation of pre-existing state and original tab/settings. Unit success does not satisfy these gates. The previous native Computer Use URL-identification failure is a separate tool limitation, not a SWU failure result.

Continue with current startup/focus and real-workflow verification, then conditional target-state actions/diagnostics, separately reviewed native input, reference repair/migration/recording. Pixel/render research remains separate. Keep the overall issue open. No release or CI execution is authorized by this checkpoint.

Code relationship evidence: Graphify0.9.95 on committed72eefb636bd975e18d92ac07a16fb9d3296a8a52 produced167 nodes/414 edges/7 communities. All selected src/extension source hashes matched before and after extraction. AST-only output is kept under this worktree's ignored .local/graphify-tab-lifecycle (reused existing tool runner); no private browser data or semantic whole-project acceptance is implied.

## 2026-10-31 disconnect investigation

Observed CLI and actual MCP status both disconnected with no session/binding; retained observations0 and saved content list empty. Existing runtime.stderr.log only contains a historical0.5.0 startup line, whereas live status is0.6.1. That file is not current connection-event evidence. No browser UI control was attempted in this investigation; earlier browser URL identification failures are separate from these SWU results.

Confirmed code defect: Runtime.command timeout/cancel clears pending, so a later result receives late-or-unowned-reply. The worker previously let that reply error escape into its outer poll-loop catch, calling disconnectOwned and tearing down the otherwise existing session. A new regression fails against the prior committed worker (adapterOwned becomes false) and passes after the fix. The worker now discards that specifically rejected result, clears input references and continues polling; it never resends the result or input. An actually changed session is still refused by the next poll; other network/authentication errors still disconnect. This proves a disconnect mechanism, not that the user's last manual connection was lost for this reason.

Added Runtime status lastDisconnect time/reason (memory-only, no schema/data migration). A newer-owner rejection cannot overwrite the diagnostic. Current bridge cleanup uses generic browser-disconnected, so historical adapter-specific reasons remain unavailable. No credential, URL or private page body is logged. Review traced command timeout, pause/cancel, reply rejection and poll/disconnect ownership. Existing unknown-delivery fences and no-retry handling are retained.

Verification: regression before/after and targeted16/16 including runtime ownership/diagnostic tests; whole suite123/123 before the final extra diagnostic test, syntax/build passed. Real Chrome focus/reading/scroll/save remains pending an actual bound session. No root-cause claim based solely on browser-control failures. Source fix is part of PR9, not an installed success or main release.

## 2026-10-31 installed Connector checkpoint

Installed reviewed43848ed source in the existing checkout's ignored .local/installed/auto-focus, with its locked dependency. Updated existing dist/extension artifact. Verified22 source/artifact files by SHA256 against the reviewed worktree. This is local candidate installation, not main adoption or a public release.

Before replacement: live status was disconnected/session null/fenced false/paused false/observations0; runtime PID21100 was confirmed to run the original checkout's src/cli.js serve. Privately backed up every existing default-home file to the dated private backup directory. No state.json existed there. Stopped only that verified owner, preserved its lock rather than deleting it, and started the installed candidate with its normal start command. New PID4288 command line points to the installed candidate. Live status includes lastDisconnect:null, proving new Runtime code is executing. Connector configuration hash is unchanged. No browser storage/token/permission reset occurred. Backup of the extension's separate private browser storage remains unverified; no data migration or clearing is attempted.

The candidate runtime stays available for existing CLI/MCP clients on the same endpoint. If it is stopped, explicitly start C:/Projects/paw-swu/.local/installed/auto-focus/src/cli.js start; the unchanged main checkout's automatic cold startup still uses main source. This limitation is not hidden as a permanent default upgrade.

Final source suite from the previous investigation:124/124 passed,0 skips, syntax/build pass; Graphify43848ed hashes unchanged,167 nodes/414 edges. Existing source/artifact hashes and actual runtime process identity were checked in this installation step; full source tests were not repeated for identical bytes.

Browser extension reload requires direct user action because the browser tool previously denied chrome://extensions and prohibited alternate-route circumvention. User was asked to reload existing SWU and connect Google after the Connector replacement. At the installation checkpoint the live connection is still false; no fresh observation/input/save was issued against an unbound browser. Connection-duration, automatic focus, real-site scroll and saved read-back remain pending. Keep PR9 and overall issue in progress.

User follow-up: connection reports bound-tab-url-unavailable before binding/transport polling. This is distinct from the late-reply disconnect defect and native browser-control errors. Chrome activeTab is granted by toolbar action, not the internal sidebar Connect button (official activeTab documentation). Asked the user to invoke the toolbar action on Google and report whether the same error persists. This is a hypothesis about missing invocation permission, not proof that toolbar invocation itself failed. Clarified the fixed diagnostic; no host permission expansion.

Toolbar invocation also reproduced the same user-reported error, ruling out the sidebar-only explanation. Added an authenticated strict bridge diagnostic (toolbar/sidebar, event URL present boolean, queried URL present boolean, timestamp); status returns this without any URL/body/token. Both fields remain unknown for the previous attempt. This diagnostic is memory-only, does not bind, grant permissions or write user data. HTTP tests reject non-extension callers and extra raw URL fields. Initial diagnostic instrumentation added an extra tabs.get that interfered with race harness ordering; removed it and instrumented the existing foreground query instead. Existing no-bind tests now exclude diagnostic-only traffic while still asserting no bind dispatch. No actual Chrome success is claimed.
