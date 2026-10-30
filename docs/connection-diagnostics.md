# Browser Adapter connection diagnostics · 0.6.1

A refused connection reports the first failed existing guard as a fixed code. The popup adds Korean/English manual guidance from `extension/diagnostics.js`. It does not report the full URL, title, token or browser API exception details. Multiple predicates may be false; one code is not a complete browser-state diagnosis.

| Code | Manual check / 직접 확인 |
|---|---|
| `connect-tab-query-failed`, `connect-tab-not-found` | Reopen the extension on the intended tab/window. / 대상 탭·창에서 확장을 다시 열어 확인하세요. |
| `bound-tab-unavailable`, `bound-window-unavailable` | Check that the intended tab/window still exists. / 대상 탭·창이 열려 있는지 확인하세요. |
| `bound-tab-inactive` | Select the intended tab manually. / 대상 탭을 직접 선택하세요. |
| `bound-tab-window-mismatch` | The tab's window no longer matches; explicitly reconnect there. / 탭의 현재 창에서 명시적으로 다시 연결하세요. |
| `bound-window-unfocused` | Bring the intended Chrome window to the foreground manually. / 대상 Chrome 창을 직접 전경으로 가져오세요. |
| `bound-window-minimized` | Restore the intended window manually. / 최소화를 직접 해제하세요. |
| `bound-tab-url-unavailable` | Chrome did not supply a URL; reopen on the intended web tab and inspect the result. / 탭 주소가 제공되지 않았습니다. 대상 웹 탭에서 확장을 다시 열어 결과를 확인하세요. |
| `bound-tab-url-not-http` | Use an ordinary HTTP(S) web tab. / 일반 HTTP(S) 웹 탭에서 연결하세요. |

These instructions are manual checks, not automatic focus, navigation, permission changes or retries. A URL-unavailable refusal does not establish its underlying cause; it is not permission to inspect a browser profile or broaden extension access. Focus/active-tab/window/HTTP(S) checks remain mandatory before and after script injection. Proved pre-dispatch refusal remains not-sent; a failure after possible execution remains unknown with no replay.

A failed bind clears only that attempt's local binding/session. Overlapping attempts are refused; disconnect during the foreground check stops the pending attempt before bind dispatch. A transport failure can leave server acceptance uncertain: local cleanup is not proof of server rollback or cancellation. Inspect the connection result and existing runtime status through supported user workflows before an explicit retry; this patch performs no automatic recovery.

Historical 0.5 checkpoint: the reported Google-home connection failure originally returned the conflated `bound-tab-must-be-active-in-focused-window`. That old message cannot identify which predicate failed. **The actual live cause remains unconfirmed.** A supervisor-refreshed installed build and a new explicit user connection attempt are needed to observe a distinct code; no such verification was performed by this worker. Source metadata stays0.5.0; no new permission, browser support or live-success claim is added.

## 0.6.1 lifecycle diagnostics

`bound-tab-not-found` recognizes only Chrome's fixed no-tab-with-id error; `bound-tab-missing` means no tab result. These retire the captured local owner. Other failures return `bound-tab-query-failed` without inferring closure. Removal/replacement events report `bound-tab-removed`/`bound-tab-replaced`; unrelated tabs have no effect. Codes contain no browser exception, URL, title or token.

The shared disconnect path clears local session/binding/document references immediately and stops the old poll loop. `/bridge/disconnect-owned` strictly requires nullable UUID `expectedSession`; Runtime.disconnect rejects a changed owner. A bind response arriving after target loss is cleaned using its returned session only. Failed cleanup reports `binding-cleanup-unconfirmed`: local status is disconnected; remote ownership may require explicit recovery. Manual disconnect alone persists the manual-disconnect flag. No automatic new tab selection/bind/retry occurs. Leased act loss remains unknown/fenced, never proof of no input.

Historical descriptions above refer to their source checkpoints. Later supervisor live evidence established sidebar opening and bounded Google observe/read only; subsequent unavailable-tab cause remains unconfirmed, and scrolling remains unverified.

Compatibility boundary: the new owned route is intentionally distinct from the old0.6 unconditional `/bridge/disconnect`. Unsupported cleanup is reported as unconfirmed; no fallback is sent. When a command detects missing target before injection, its known refusal is delivered before cleanup. A failed/lost reply remains unknown/fenced. Event-driven target loss during possible input remains conservative.

## 2026-10-30 automatic-focus follow-up

The earlier manual-focus descriptions are historical. Live commands now activate only their existing bound tab/window, recheck before dispatch, and preserve post-dispatch uncertainty. Status and retained/saved reading stay passive; reconnect, resume and stale-input recovery remain explicit. [Behavior, regression and installed/live status](automatic-focus.md). This follows the user-requested usability work before further capability expansion.
