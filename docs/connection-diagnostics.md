# Browser Adapter connection diagnostics · 0.5.0

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

The reported Google-home connection failure originally returned the conflated `bound-tab-must-be-active-in-focused-window`. That old message cannot identify which predicate failed. **The actual live cause remains unconfirmed.** A supervisor-refreshed installed build and a new explicit user connection attempt are needed to observe a distinct code; no such verification was performed by this worker. Source metadata stays0.5.0; no new permission, browser support or live-success claim is added.
