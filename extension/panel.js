export function describePanelStatus(s) {
  if (!s.paired)
    return {
      key: "pairing-needed",
      label: "처음 연결이 필요해요",
      detail: "설정에서 로컬 연결 토큰을 저장하세요.",
    };
  if (!s.runtimeAvailable)
    return {
      key: "runtime-unavailable",
      label: "Connector를 시작해 주세요",
      detail: "설치한 SWU 시작 아이콘을 실행한 뒤 상태를 확인하세요.",
    };
  if (s.runtime.paused)
    return {
      key: "paused",
      label: "전체 작업 일시정지",
      detail: "직접 재개한 뒤 새 화면을 읽어 주세요.",
    };
  if (s.runtime.fenced)
    return {
      key: "fenced",
      label: "전달 결과 확인 필요",
      detail: "입력 결과가 불명확합니다. 영수증을 확인하고 재전송하지 마세요.",
    };
  if (s.userDisconnected)
    return {
      key: "disconnected",
      label: "직접 연결 해제됨",
      detail: "대상 창에서 연결 버튼을 눌러 명시적으로 연결하세요.",
    };
  if (
    s.runtime.connected &&
    s.runtime.binding &&
    s.foregroundReady === true &&
    s.adapterOwned === true
  )
    return {
      key: "connected",
      label: "전경 탭에 연결됨",
      detail:
        "현재 보이는 내용을 읽을 수 있어요. 입력은 별도 가드로 검사합니다.",
    };
  return {
    key: "target-needed",
    label: "사용할 탭을 선택해 주세요",
    detail: "일반 웹 탭에서 툴바의 SWU 아이콘을 누르거나 직접 연결하세요.",
  };
}
export function createStatusPoller({
  isVisible,
  load,
  onStatus,
  onError,
  schedule = setTimeout,
  cancel = clearTimeout,
  interval = 2000,
}) {
  let active = false,
    busy = false,
    timer = null,
    generation = 0;
  const refresh = async () => {
    if (timer !== null) {
      cancel(timer);
      timer = null;
    }
    if (!active || !isVisible() || busy) return;
    busy = true;
    const owned = generation;
    try {
      const s = await load();
      if (active && owned === generation && isVisible()) onStatus(s);
    } catch (e) {
      if (active && owned === generation && isVisible()) onError(e);
    } finally {
      busy = false;
      if (active && isVisible())
        timer = schedule(() => {
          timer = null;
          void refresh();
        }, interval);
    }
  };
  return {
    refresh,
    start() {
      if (active || !isVisible()) return;
      active = true;
      generation++;
      void refresh();
    },
    stop() {
      active = false;
      generation++;
      if (timer !== null) cancel(timer);
      timer = null;
    },
  };
}
