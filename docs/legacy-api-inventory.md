# Nomiya API 전체 목록과 PAW 대응 — 0.4.0

Nomiya fcfbe5a197b688b1640766b67d4d79b6e505f683의 src/api-catalog.ts에 등록된 92개 명령과 src/main.ts의 연결 지점을 대조한 누락 점검표다. 등록·호출 지점 확인은 각 함수의 모든 동작이나 과거 실측을 검증했다는 뜻이 아니다. 상세 함수별 근거는 [계승표](legacy-parity.md), 새 구현의 실제 검사 범위는 [검증 기록](validation.md)을 따른다.

부분 대응은 새로운 호스트·자료 계약으로 제한된 책임을 구현했다는 뜻이다. 이름/기능 수를 제품 완성률로 계산하지 않는다. 네이티브 입력·픽셀 읽기·설치·실사이트 결과까지 완료한 행은 없다. 직접 확보하지 못한 Sakaba/gen3 원본은 이 92개 목록에 포함되지 않는다.

| 원본 분류 | 명령 | 상태 | 새 대응과 남은 범위 |
|---|---|---|---|
| website/discovery | `structureActions` | 부분 대응 | MCP 스키마·capabilities. 현재 실행 허가는 별도이며 원본 명령 계약과 호환되지 않는다. |
| website/discovery | `context` | 부분 대응 | observe + 판본 고정 packContext. 기존 경보·참조 의미 엔진 전체는 미계승. |
| website/discovery | `knowledgeContext` | 미구현 | 호버·스크롤의 조건부 경험 지식·반례·재검사. 입력 소유권과 실사이트 관찰을 먼저 검증해야 한다. |
| website/discovery | `resolve` | 부분 대응 | 선언한 locator의 현재 후보·모호함 검사. fingerprint 기반 재결합·자동 수선은 미구현. |
| website/reading | `content` | 부분 대응 | read의 역할·영역·내용 종류·다중 항목·판본 고정 페이지. 원본의 공간/의미 객체 모델 전체는 미계승. |
| website/reading | `contentRegions` | 부분 대응 | read의 역할·영역·내용 종류·다중 항목·판본 고정 페이지. 원본의 공간/의미 객체 모델 전체는 미계승. |
| website/reading | `observe` | 부분 대응 | observe의 불변 뷰포트 DOM 근거. 픽셀·원본 remember 형식·다른 수집 전략은 미계승. |
| website/reading | `snapshot` | 부분 대응 | observe의 불변 뷰포트 DOM 근거. 픽셀·원본 remember 형식·다른 수집 전략은 미계승. |
| website/reading | `snapshotRead` | 부분 대응 | observationRead/History. 32개·16MiB 메모리 보관이며 원본 조회 임대는 없다. |
| website/reading | `snapshotHistory` | 부분 대응 | observationRead/History. 32개·16MiB 메모리 보관이며 원본 조회 임대는 없다. |
| website/reading | `snapshotDiff` | 부분 대응 | 호환 관찰의 안정된 DOM ref와 필드 차이. 원본의 지역 기하/의미 대응·교차 문서 대응은 미계승. |
| website/reading | `plate` | 부분 대응 | observe/read/capabilities를 조합할 수 있으나 동일한 통합 plate 계약은 없다. |
| website/reading | `contentRegionDiff` | 부분 대응 | 호환 관찰의 안정된 DOM ref와 필드 차이. 원본의 지역 기하/의미 대응·교차 문서 대응은 미계승. |
| website/reading | `scrollContainers` | 부분 대응 | 관찰의 요소 rect 및 제한된 요소 스크롤만 제공. 영역별 수신 경로·상대 측정·보정 조회는 미구현. |
| website/reading | `geometry` | 부분 대응 | 관찰의 요소 rect 및 제한된 요소 스크롤만 제공. 영역별 수신 경로·상대 측정·보정 조회는 미구현. |
| website/reading | `condition` | 부분 대응 | 팩의 scope/pre/post/arrival 조건. 독립적인 범용 DOM 조건 조회 API는 없다. |
| website/reading | `uiQuery` | 부분 대응 | read의 역할·영역·내용 종류·다중 항목·판본 고정 페이지. 원본의 공간/의미 객체 모델 전체는 미계승. |
| website/reading | `uiQueryStream` | 부분 대응 | read의 역할·영역·내용 종류·다중 항목·판본 고정 페이지. 원본의 공간/의미 객체 모델 전체는 미계승. |
| website/reading | `uiObjectDiff` | 부분 대응 | 호환 관찰의 안정된 DOM ref와 필드 차이. 원본의 지역 기하/의미 대응·교차 문서 대응은 미계승. |
| website/reading | `pageObservation` | 부분 대응 | 관찰 이력과 명시적인 문서 섹션을 보존한다. 자동 페이지 관찰 축적·대체/공백 추적은 미구현. |
| website/reading | `pageObservationHistory` | 부분 대응 | 관찰 이력과 명시적인 문서 섹션을 보존한다. 자동 페이지 관찰 축적·대체/공백 추적은 미구현. |
| website/reading | `pageDocument` | 부분 대응 | documentCreate/Append/List/Read/Export. 명시 저장한 호환 섹션·재시작·무결성·선택적 Markdown/메타데이터 묶음. 원본 형식/자동 합성 문서와 호환되지 않는다. |
| website/reading | `pageDocumentHistory` | 부분 대응 | documentCreate/Append/List/Read/Export. 명시 저장한 호환 섹션·재시작·무결성·선택적 Markdown/메타데이터 묶음. 원본 형식/자동 합성 문서와 호환되지 않는다. |
| website/reading | `contentPublication` | 부분 대응 | 명시 저장/읽기/문서 내보내기. 고정 파일 경로 발행·유효성 추적·자동 갱신 상태는 미구현. |
| website/reading | `renderFrameContent` | 연구 기능 미구현 | 프레임 구독·보관·본문 출처 대응·차이. DOM 관찰 이력으로 대체됐다고 하지 않는다. |
| website/reading | `renderFrameContentQuery` | 연구 기능 미구현 | 프레임 구독·보관·본문 출처 대응·차이. DOM 관찰 이력으로 대체됐다고 하지 않는다. |
| website/reading | `renderFrameContentDiff` | 연구 기능 미구현 | 프레임 구독·보관·본문 출처 대응·차이. DOM 관찰 이력으로 대체됐다고 하지 않는다. |
| website/interaction | `structureAction` | 부분 대응 | packRun의 판본 고정 역할 절차와 단일 클릭 뒤 제한된 도착 확인. 네이티브 검색 제출·기존 녹화 형식·자동 계획기는 미계승. |
| website/interaction | `act` | 부분 대응 | 합성 fill/링크 click/요소 scroll만 지원. 네이티브 move/hover/hold/drag/keys/clipboard 등은 미구현. |
| website/interaction | `conditionalClick` | 미구현 | 목표 상태가 이미 충족됐으면 입력하지 않고 그렇지 않을 때 최대 한 번 클릭하는 별도 계약. 일반 packRun과 동일시하지 않는다. |
| website/interaction | `replay` | 부분 대응 | packRun의 판본 고정 역할 절차와 단일 클릭 뒤 제한된 도착 확인. 네이티브 검색 제출·기존 녹화 형식·자동 계획기는 미계승. |
| website/interaction | `pageReadStart` | 미구현 | 제한된 스크롤·추가 읽기·진행·취소의 연결 경로. 수동 섹션 append가 이를 대신하지 않는다. |
| swu/discovery | `apiInfo` | 부분 대응 | MCP 스키마·capabilities. 현재 실행 허가는 별도이며 원본 명령 계약과 호환되지 않는다. |
| swu/discovery | `apiCommands` | 부분 대응 | MCP 스키마·capabilities. 현재 실행 허가는 별도이며 원본 명령 계약과 호환되지 않는다. |
| swu/connection | `tabs` | 미구현 | 연결 가능한 기존 탭 목록/선택 API. 현재 확장 UI는 활성 탭만 연결한다. |
| swu/connection | `bind` | 부분 대응 | 확장 UI의 현재 탭 연결/해제. 원본 호스트·일시 작업면 옵션은 미계승. |
| swu/connection | `workSurfaceStop` | 호스트 전용 미계승 | 소유한 일시적 1920 작업면 정리. 새 확장은 창/줌/탭을 자동 변경하지 않는다. 동등한 대체 구현으로 주장하지 않는다. |
| swu/connection | `backgroundStart` | 행동 차이 유지 | 원본의 제한 시간·비포커스 실행 모드. 새 경로는 전경 활성 탭을 요구한다. 도입 여부와 권한/가시성 계약을 별도로 결정해야 한다. |
| swu/connection | `backgroundStop` | 행동 차이 유지 | 원본의 제한 시간·비포커스 실행 모드. 새 경로는 전경 활성 탭을 요구한다. 도입 여부와 권한/가시성 계약을 별도로 결정해야 한다. |
| swu/diagnostics | `status` | 부분 대응 | status 및 capabilities의 연결/차단 이유. 원본 호스트 능력/환경 진단 전체는 미계승. |
| swu/diagnostics | `hostStatus` | 부분 대응 | status 및 capabilities의 연결/차단 이유. 원본 호스트 능력/환경 진단 전체는 미계승. |
| swu/diagnostics | `acquisitionStatus` | 미구현 | 수집 단계별 비용·실패·누락 진단. 현재 coverage만으로 동일하다고 하지 않는다. |
| swu/diagnostics | `inputLog` | 부분 대응 | operation별 지속 receipt 조회. 외부 입력 출처·포인터 이벤트/로그 커서는 미계승. |
| swu/diagnostics | `pointer` | 미구현 | 지속 포인터 상태·실제 커서 관찰·원래 수신자 release/복구·표시 설정. 네이티브 어댑터와 함께 검증해야 한다. |
| swu/diagnostics | `cursor` | 미구현 | 지속 포인터 상태·실제 커서 관찰·원래 수신자 release/복구·표시 설정. 네이티브 어댑터와 함께 검증해야 한다. |
| swu/diagnostics | `contentRefreshStatus` | 미구현 | 상시 관찰/갱신 정책·상태. 수동 observe와 별개이며 감시 프로세스를 자동 설치하지 않는다. |
| swu/diagnostics | `viewportMonitor` | 미구현 | 상시 관찰/갱신 정책·상태. 수동 observe와 별개이며 감시 프로세스를 자동 설치하지 않는다. |
| swu/diagnostics | `renderFrameStatus` | 연구 기능 미구현 | 프레임 구독·보관·본문 출처 대응·차이. DOM 관찰 이력으로 대체됐다고 하지 않는다. |
| swu/diagnostics | `pageReadStatus` | 미구현 | 제한된 스크롤·추가 읽기·진행·취소의 연결 경로. 수동 섹션 append가 이를 대신하지 않는다. |
| swu/diagnostics | `pageDocumentPublication` | 부분 대응 | 명시 저장/읽기/문서 내보내기. 고정 파일 경로 발행·유효성 추적·자동 갱신 상태는 미구현. |
| swu/execution | `cancel` | 부분 대응 | operation별 취소와 도착 관찰 중단, 불명 입력 재시도 금지. 전역 작업면 복구/입력 되돌리기는 미계승. |
| swu/execution | `pause` | 부분 대응 | 저장되는 pause/resume, 대기 작업·입력 참조 무효화와 unknown fence 보존. 원본 모니터·네이티브 입력 해제는 미계승. |
| swu/execution | `pageReadCancel` | 미구현 | 제한된 스크롤·추가 읽기·진행·취소의 연결 경로. 수동 섹션 append가 이를 대신하지 않는다. |
| swu/execution | `pointerRecover` | 미구현 | 지속 포인터 상태·실제 커서 관찰·원래 수신자 release/복구·표시 설정. 네이티브 어댑터와 함께 검증해야 한다. |
| swu/execution | `pointerConfigure` | 미구현 | 지속 포인터 상태·실제 커서 관찰·원래 수신자 release/복구·표시 설정. 네이티브 어댑터와 함께 검증해야 한다. |
| swu/execution | `viewportMonitorConfigure` | 미구현 | 상시 관찰/갱신 정책·상태. 수동 observe와 별개이며 감시 프로세스를 자동 설치하지 않는다. |
| swu/execution | `renderFrameStart` | 연구 기능 미구현 | 프레임 구독·보관·본문 출처 대응·차이. DOM 관찰 이력으로 대체됐다고 하지 않는다. |
| swu/execution | `renderFrameStop` | 연구 기능 미구현 | 프레임 구독·보관·본문 출처 대응·차이. DOM 관찰 이력으로 대체됐다고 하지 않는다. |
| swu/execution | `snapshotRetention` | 부분 대응 | 고정 관찰 수/바이트 한도. 명시 조회 임대·보관 정책 변경은 미구현. |
| swu/execution | `pick` | 부분 대응 | 관찰 대상 선택 후 개인 팩 초안 제안. 원본 참조 저장 형식과 locator 외 식별 근거는 미계승. |
| swu/knowledge | `create` | 부분 대응 | packDraft/Propose/Test와 예상 판본 충돌 검사. 기존 페이지 자동 등록과 정의 검사 의미 전체는 미계승. |
| swu/knowledge | `save` | 부분 대응 | packDraft/Propose/Test와 예상 판본 충돌 검사. 기존 페이지 자동 등록과 정의 검사 의미 전체는 미계승. |
| swu/knowledge | `register` | 부분 대응 | packDraft/Propose/Test와 예상 판본 충돌 검사. 기존 페이지 자동 등록과 정의 검사 의미 전체는 미계승. |
| swu/knowledge | `reference` | 부분 대응 | 관찰 대상 선택 후 개인 팩 초안 제안. 원본 참조 저장 형식과 locator 외 식별 근거는 미계승. |
| swu/knowledge | `definitionTest` | 부분 대응 | packDraft/Propose/Test와 예상 판본 충돌 검사. 기존 페이지 자동 등록과 정의 검사 의미 전체는 미계승. |
| swu/knowledge | `commonType` | 미구현 | 공통 타입·PageTemplate 후보 작성/재검사. 공유 베이스/오버레이와 혼동하지 않는다. |
| swu/knowledge | `templateCreate` | 미구현 | 공통 타입·PageTemplate 후보 작성/재검사. 공유 베이스/오버레이와 혼동하지 않는다. |
| swu/knowledge | `templateRecheck` | 미구현 | 공통 타입·PageTemplate 후보 작성/재검사. 공유 베이스/오버레이와 혼동하지 않는다. |
| swu/knowledge | `probeScroll` | 미구현 | 호버·스크롤의 조건부 경험 지식·반례·재검사. 입력 소유권과 실사이트 관찰을 먼저 검증해야 한다. |
| swu/knowledge | `probeHover` | 미구현 | 호버·스크롤의 조건부 경험 지식·반례·재검사. 입력 소유권과 실사이트 관찰을 먼저 검증해야 한다. |
| swu/knowledge | `recordStart` | 미구현 | 실행/사용자 입력의 명시 녹화와 초안 생성/폐기. 수동 절차 편집과 별개다. |
| swu/knowledge | `recordStop` | 미구현 | 실행/사용자 입력의 명시 녹화와 초안 생성/폐기. 수동 절차 편집과 별개다. |
| swu/knowledge | `recordDiscard` | 미구현 | 실행/사용자 입력의 명시 녹화와 초안 생성/폐기. 수동 절차 편집과 별개다. |
| swu/storage | `packs` | 부분 대응 | 버전 있는 팩 목록. 원본 저장 형식은 호환되지 않는다. |
| swu/storage | `read` | 부분 대응 | 원본 read는 팩 읽기이므로 새 packGet에 대응한다. 새 read(콘텐츠 읽기)와 이름만으로 동일시하지 않는다. |
| swu/storage | `archive` | 부분 대응 | packArchive/Unarchive가 충돌 검사·원본 판본 보존·보관 상태를 제공한다. 파일 이동 형식이 아니며 pinned overlay의 base는 보존한다. |
| swu/storage | `restore` | 부분 대응 | packRestore가 저장 판본을 비활성 초안으로 복구하고 새 검사/활성화를 요구한다. 원본 backup 파일/설치 형식 이전과 사이트 상태 복구는 아니다. |
| swu/storage | `export` | 부분 대응 | 정의만의 packExport/Import와 충돌 검사. 기존 Nomiya/Izakaya 데이터 이전은 별도 미구현. |
| swu/storage | `import` | 부분 대응 | 정의만의 packExport/Import와 충돌 검사. 기존 Nomiya/Izakaya 데이터 이전은 별도 미구현. |
| swu/storage | `pageDocumentExports` | 부분 대응 | documentCreate/Append/List/Read/Export. 명시 저장한 호환 섹션·재시작·무결성·선택적 Markdown/메타데이터 묶음. 원본 형식/자동 합성 문서와 호환되지 않는다. |
| swu/storage | `pageDocumentExport` | 부분 대응 | documentCreate/Append/List/Read/Export. 명시 저장한 호환 섹션·재시작·무결성·선택적 Markdown/메타데이터 묶음. 원본 형식/자동 합성 문서와 호환되지 않는다. |
| swu/storage | `pageDocumentSave` | 부분 대응 | documentCreate/Append/List/Read/Export. 명시 저장한 호환 섹션·재시작·무결성·선택적 Markdown/메타데이터 묶음. 원본 형식/자동 합성 문서와 호환되지 않는다. |
| swu/storage | `contentPublish` | 부분 대응 | 명시 저장/읽기/문서 내보내기. 고정 파일 경로 발행·유효성 추적·자동 갱신 상태는 미구현. |
| swu/research | `recheck` | 미구현 | 일시 수집 예산 확대 후 복원. 현재 고정 예산을 자동으로 풀지 않는다. |
| swu/research | `observePoint` | 연구 기능 미구현 | 점/픽셀/렌더 영역/ASCII/브라우저 배치/화면/AX 증거. 실제 렌더러·좌표/시간 대응 검증이 별도로 필요하다. |
| swu/research | `renderProbe` | 연구 기능 미구현 | 점/픽셀/렌더 영역/ASCII/브라우저 배치/화면/AX 증거. 실제 렌더러·좌표/시간 대응 검증이 별도로 필요하다. |
| swu/research | `renderRegionDiff` | 연구 기능 미구현 | 점/픽셀/렌더 영역/ASCII/브라우저 배치/화면/AX 증거. 실제 렌더러·좌표/시간 대응 검증이 별도로 필요하다. |
| swu/research | `renderFrameAscii` | 연구 기능 미구현 | 점/픽셀/렌더 영역/ASCII/브라우저 배치/화면/AX 증거. 실제 렌더러·좌표/시간 대응 검증이 별도로 필요하다. |
| swu/research | `layoutEvidence` | 연구 기능 미구현 | 점/픽셀/렌더 영역/ASCII/브라우저 배치/화면/AX 증거. 실제 렌더러·좌표/시간 대응 검증이 별도로 필요하다. |
| swu/research | `screenshot` | 연구 기능 미구현 | 점/픽셀/렌더 영역/ASCII/브라우저 배치/화면/AX 증거. 실제 렌더러·좌표/시간 대응 검증이 별도로 필요하다. |
| swu/research | `accessibility` | 연구 기능 미구현 | 점/픽셀/렌더 영역/ASCII/브라우저 배치/화면/AX 증거. 실제 렌더러·좌표/시간 대응 검증이 별도로 필요하다. |
| swu/research | `lab` | 과거 시험 자산 | 과거 로컬 시험 탭 생성/연결. 새 합성 검사도 실사이트 검증을 대신하지 않는다. |

추가 누락으로 확인한 전역 pause, 팩 archive/restore, 탭 목록, 목표 상태 기반 conditionalClick, 제한된 pageRead, 자동 갱신/수집 진단, 공통 타입/템플릿과 녹화 기능은 열린 작업으로 유지한다. 구현 순서는 이미 준비된 기반을 재사용하는 저장/상태 관리 → 조건부 동작/읽기 → 네이티브 소유권/검증 → 경험 지식/기록 및 독립 렌더 연구로 구체화한다. 자동 권한 확대·감시 활성화로 해석하지 않는다.
