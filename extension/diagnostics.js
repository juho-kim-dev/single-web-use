// Fixed guidance only: never append page URLs, titles, tokens or browser API details.
const guidance = {
  "tab-not-bound":
    "대상 탭에서 확장을 열고 연결하세요. / Open the extension on the intended tab and connect.",
  "connect-tab-query-failed":
    "현재 탭을 확인하지 못했습니다. 대상 창에서 확장을 다시 열어 확인하세요. / Could not inspect the current tab; reopen the extension in the intended window.",
  "connect-tab-not-found":
    "현재 탭 정보를 찾지 못했습니다. 대상 탭에서 확장을 다시 여세요. / Current tab details are unavailable; reopen the extension on the intended tab.",
  "bound-tab-unavailable":
    "대상 탭을 확인할 수 없습니다. 탭이 열려 있는지 확인하세요. / The intended tab is unavailable; check that it is still open.",
  "bound-window-unavailable":
    "대상 창을 확인할 수 없습니다. 해당 창이 열려 있는지 확인하세요. / The intended window is unavailable; check that it is still open.",
  "bound-tab-inactive":
    "대상 탭을 직접 선택한 뒤 확장을 다시 여세요. / Select the intended tab manually, then reopen the extension.",
  "bound-tab-window-mismatch":
    "탭의 창이 바뀌었습니다. 대상 창에서 명시적으로 다시 연결하세요. / The tab changed windows; explicitly reconnect from its current window.",
  "bound-window-unfocused":
    "대상 Chrome 창을 직접 전경으로 가져온 뒤 다시 확인하세요. / Bring the intended Chrome window to the foreground manually, then check again.",
  "bound-window-minimized":
    "대상 창의 최소화를 직접 해제하세요. / Restore the intended window manually.",
  "bound-tab-url-unavailable":
    "탭 주소가 제공되지 않았습니다. 대상 웹 탭에서 확장을 다시 열어 확인하세요. 권한은 자동 변경되지 않습니다. / The tab URL was not supplied; reopen the extension on the intended web tab. Permissions are not changed automatically.",
  "bound-tab-url-not-http":
    "일반 HTTP(S) 웹 탭에서 연결하세요. / Connect from an ordinary HTTP(S) web tab.",
  "disconnect-before-rebind":
    "연결 또는 연결 시도가 진행 중입니다. 완료를 확인하거나 명시적으로 연결 해제하세요. / A connection or attempt is active; inspect its result or explicitly disconnect.",
  "binding-changed-during-connect":
    "연결 중 대상이 바뀌었습니다. 상태를 확인한 뒤 명시적으로 연결하세요. / The binding changed during connection; inspect status before explicitly connecting.",
};
export function connectionGuidance(code) {
  return Object.hasOwn(guidance, code) ? `${code} · ${guidance[code]}` : code;
}
