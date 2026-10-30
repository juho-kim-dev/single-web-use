// Fixed guidance only: never append page URLs, titles, tokens or browser API details.
const guidance = {
  "bound-window-activation-failed":
    "대상 창 자동 활성화에 실패했습니다. 창 상태를 확인하세요. 입력을 자동 재전송하지 않습니다. / Window activation failed; inspect the window. No automatic input retry.",
  "bound-tab-activation-failed":
    "대상 탭 자동 활성화에 실패했습니다. 연결 상태를 확인하세요. / Tab activation failed; inspect the binding.",
  "runtime-update-restart-required":
    "Connector 업데이트·명시 재시작이 필요합니다. 기존 런타임이나 잠금을 자동 변경하지 않습니다. / Update and explicitly restart the Connector; its owner and lock are left unchanged.",
  "automatic-bind-session-changed":
    "상태 확인 후 연결 소유자가 바뀌었습니다. 현재 상태를 확인하세요. / The runtime session changed; inspect current ownership.",
  "automatic-bind-owner-exists":
    "다른 연결을 자동 교체하지 않습니다. 소유자를 확인하고 직접 복구하세요. / An established owner is not replaced automatically; inspect and recover explicitly.",
  "automatic-bind-busy":
    "작업 중에는 자동 연결하지 않습니다. 완료 후 상태를 확인하세요. / Automatic binding is refused while work is busy.",
  "automatic-bind-paused":
    "일시정지 중에는 자동 연결하지 않습니다. / Automatic binding is refused while paused.",
  "automatic-bind-fenced":
    "입력 전달 결과를 확인해야 합니다. 자동 연결로 fence를 지우지 않습니다. / Inspect uncertain delivery; automatic binding does not clear its fence.",
  "panel-window-required":
    "이 패널의 창을 확인하지 못했습니다. 대상 창의 툴바에서 다시 여세요. / Open the sidebar from the intended window toolbar.",
  "side-panel-open-failed":
    "툴바를 직접 눌러 패널을 여세요. / Open the sidebar with a direct toolbar gesture.",
  "explicit-disconnect-retained":
    "직접 연결 해제한 상태입니다. 연결 버튼으로 명시적으로 연결하세요. / Explicitly connect from the panel after a manual disconnect.",
  "runtime-unavailable":
    "SWU 시작 아이콘으로 Connector를 켠 뒤 상태를 확인하세요. / Start the Connector with the installed SWU launcher, then inspect status.",
  "pairing-token-required":
    "설정에서 첫 연결 토큰을 저장하세요. / Save the local pairing token in settings first.",

  "tab-not-bound":
    "대상 탭에서 확장을 열고 연결하세요. / Open the extension on the intended tab and connect.",
  "connect-tab-query-failed":
    "현재 탭을 확인하지 못했습니다. 대상 창에서 확장을 다시 열어 확인하세요. / Could not inspect the current tab; reopen the extension in the intended window.",
  "connect-tab-not-found":
    "현재 탭 정보를 찾지 못했습니다. 대상 탭에서 확장을 다시 여세요. / Current tab details are unavailable; reopen the extension on the intended tab.",
  "bound-tab-not-found":
    "Chrome이 대상 탭 없음을 확인했습니다. 직접 다시 연결하세요. / Chrome reports no such tab; reconnect explicitly.",
  "bound-tab-missing":
    "대상 탭 정보가 없습니다. 직접 연결하세요. / Target details are missing; connect explicitly.",
  "bound-tab-query-failed":
    "탭 조회 실패입니다. 상태를 확인하세요. / Tab inspection failed; inspect status.",
  "bound-tab-removed":
    "연결한 탭이 닫혔습니다. 직접 연결하세요. / The bound tab closed; connect explicitly.",
  "bound-tab-replaced":
    "연결한 탭이 교체되었습니다. 직접 연결하세요. / The bound tab was replaced; reconnect explicitly.",
  "binding-cleanup-unconfirmed":
    "로컬 연결은 해제됐으나 원격 정리를 확인하지 못했습니다. 직접 복구하세요. / Local ownership ended; remote cleanup is unconfirmed. Recover explicitly.",
  "disconnect-session-changed":
    "새 연결 소유자를 보존했습니다. / A newer session was preserved.",
  "bound-tab-unavailable":
    "대상 탭을 확인할 수 없습니다. 탭이 열려 있는지 확인하세요. / The intended tab is unavailable; check that it is still open.",
  "bound-window-unavailable":
    "대상 창을 확인할 수 없습니다. 해당 창이 열려 있는지 확인하세요. / The intended window is unavailable; check that it is still open.",
  "bound-tab-inactive":
    "대상 탭이 비활성 상태입니다. 화면 작업 요청 시 자동 활성화 후 재확인합니다. / A live command activates and rechecks the inactive target tab.",
  "bound-tab-window-mismatch":
    "탭의 창이 바뀌었습니다. 대상 창에서 명시적으로 다시 연결하세요. / The tab changed windows; explicitly reconnect from its current window.",
  "bound-window-unfocused":
    "대상 창에 포커스가 없습니다. 화면 작업 요청 시 자동 활성화 후 재확인합니다. / A live command activates and rechecks the unfocused target window.",
  "bound-window-minimized":
    "대상 창이 최소화되어 있습니다. 화면 작업 요청 시 복원 후 재확인합니다. / A live command restores and rechecks the minimized window.",
  "bound-tab-url-unavailable":
    "대상 웹 탭에서 Chrome 상단의 SWU 툴바 아이콘 자체를 누른 뒤 연결하세요. 사이드바 내부 연결 버튼은 탭 접근 권한을 부여하지 않습니다. / Click the SWU toolbar action on the intended web tab, then connect. The sidebar Connect button does not grant activeTab access.",
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
