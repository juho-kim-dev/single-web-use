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
