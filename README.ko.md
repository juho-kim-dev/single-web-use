# Single Web Use

**이미 열어 둔 브라우저를 AI가 현재 근거·입력 가드·재사용 가능한 사이트 기능으로 사용하도록 돕습니다.**

[English](README.md) · [구조](docs/architecture.md) · [요구와 상태](docs/requirements.md) · [계승 분석](docs/inheritance.md)

SWU는 **PAW(Personal AI Workspace)**의 브라우저 사용 구성요소입니다. 전경 탭의 현재 뷰포트를 관찰하고 사용자가 정의한 역할을 찾으며 입력 직전에 대상을 다시 검사합니다. 요청 수락·입력 전달·후조건 관찰을 구분합니다. 모델 내장 computer-use나 사이트 자체 도구는 필수 조건이 아닙니다.

기존 SWU의 계약을 이어가는 별도 PAW 구현입니다. Nomiya를 교체하거나 Obsidian 볼트에 설치하지 않으며 저장 형식도 별개입니다. [Juho Kim](https://github.com/juho-kim-dev)이 AI의 도움을 받아 개발합니다.

## 0.5.0 개발 검토 지점

팩 판본을 고정한 `pageRead`가 현재 컨테이너의 필터 읽기와 제한된 합성 요소 스크롤을 연결합니다. 진행 영수증·취소·시간/횟수/내용 예산을 제공하며 자동 저장이나 완독은 주장하지 않습니다. [읽기 계약](docs/page-reading.md).

저장되는 전역 일시정지·재개, 대기 작업·과거 입력 근거 무효화, 팩 보관·보관 해제·과거 판본 복원을 추가했습니다. 복원은 비활성 초안으로 돌아가며 새 검사·활성화가 필요합니다. [제어·보관 계약](docs/control-and-lifecycle.md).

확장–Connector 인증 통신, 제한된 DOM 뷰포트 관찰, 합성 필드 입력·일반 링크 클릭·요소 스크롤, CLI·stdio MCP, 팩 초안/시험/활성화/실행/내보내기/가져오기와 고정 기반 오버레이·갱신 미리보기를 구현했습니다.

이번 증분은 필터 읽기·다중 항목·같은 관찰의 페이지 이동, 관찰 읽기/이력/차이, 명시 저장본의 재시작 후 조회, 기능·인자·차단 이유 발견, 일반 필드 작성과 비활성화를 추가합니다. 링크 제목은 같은 역할 아래에서 이미 관찰한 문자 조각만 합치며 URL은 그 역할 노드 자체의 값만 사용합니다. [기능별 이전 소스 대조와 구체적 미완 범위](docs/legacy-parity.md).

Windows·Node 24.22.1에서 구문/빌드/계약·런타임·저장·HTTP·MCP 검사와 임시 별도 프로필의 headless Chrome 합성 DOM 검사를 수행했습니다. **확장 설치, 전경 Chrome 통합, 실사이트 유용성, AI 클라이언트 연결은 미검증입니다.** 스토어·npm 릴리스나 모든 사이트 지원을 주장하지 않습니다. [검증 구분](docs/validation.md).

## 두 설치 단위

Node 22+와 Chromium 확장 환경이 필요합니다. 현재 검사는 Windows에서 수행했으며 다른 OS·브라우저 설치는 검증하지 않았습니다.

```sh
npm ci
npm run check
npm test
npm run build
```

1. Chrome `chrome://extensions` 개발자 모드에서 **압축해제된 확장 프로그램 로드**로 `dist/extension`을 선택하고 ID를 확인합니다. 수동 개발용 설치입니다.
2. 체크아웃에서 `node src/cli.js init EXTENSION_ID`, 이어서 `node src/cli.js serve`를 실행합니다. 런타임 터미널을 유지합니다.
3. 비공개 `~/.paw-swu/connector.json`을 로컬에서 열어 token만 확장 Connect 입력란에 복사하고 저장합니다. 채팅·로그·Git에 남기지 마세요. Windows에서는 개인 사용자 프로필 안의 접근이 제한된 폴더를 사용합니다. `SWU_HOME`으로 개인 경로를 지정할 수 있습니다.
4. 일반 HTTP(S) 페이지에서 확장을 열어 **Connect current tab**을 누릅니다. 선택한 탭과 창을 활성 상태로 유지합니다.
5. 다른 터미널에서 `node src/cli.js status`, `node src/cli.js observe`, `node src/cli.js packs`를 실행합니다. `node src/cli.js call METHOD request.json`으로 같은 API를 호출합니다. 관찰 출력에는 개인 페이지 내용이 포함될 수 있습니다.

권한은 activeTab·scripting·storage와 `127.0.0.1:47831` 연결뿐입니다. 상시 전체 사이트 접근·외부 공개 리스너는 없습니다. `npm pack`은 Connector·빌드 확장·예제·사용 skill을 묶습니다. 업데이트는 런타임 종료→의존성/빌드→확장 새로고침→같은 ID 확인→재연결 순서입니다. ID 변경 시 상태를 지우지 않고 [재페어링](SECURITY.md)합니다.

## MCP와 사용 skill

같은 런타임을 유지하고 MCP 클라이언트에 `command: "node"`, `args: ["절대경로/src/cli.js", "mcp"]`의 stdio 서버를 등록합니다. 등록 방식은 해당 클라이언트 문서를 따릅니다. 일반 예시는 [영문 README](README.md)에 있으며 특정 AI 앱과의 연결 성공 근거는 아닙니다. 동봉한 [사용 skill](skills/swu/SKILL.md)은 에이전트의 지원 설치 방식으로 등록합니다. 인증·설정을 자동 변경하지 않습니다.

## 개인 사이트팩 수명

**Observe → Read now → 대상 선택 → 초안 편집 → Save draft → Test current draft → Activate tested revision** 순서입니다. 시험은 새 관찰로 현재 찾을 수 있는 역할을 검사하며 미래 역할·절차 결과는 미확인으로 남깁니다. AI 제안은 자동 활성화되지 않습니다.

JSON 편집기에서 사이트/전역·경로·조건 범위, 역할과 선택자, 추출, 권한, 초기/최종 조건과 절차를 정의합니다. fill은 이름 있는 문자열 매개변수를 지원합니다. 편집기 실행 패널이나 CLI/MCP에서 인자를 전달합니다. 초기 전제조건은 한 번, 범위 조건·현재 단계 대상은 단계마다, 후조건은 마지막에 확인합니다. 미관찰 대상을 없다고 추정하지 않습니다.

일반 입력란으로 이름·범위·역할·선택자·추출·단일/다중 수량과 fill/scroll/link 절차를 작성할 수 있습니다. **Apply fields**는 미저장 초안만 바꾸고 저장·시험·활성화는 별도입니다. 고급 JSON은 조건 등 세부 편집용으로 유지합니다. **Deactivate**는 활성 판본만 끄고 원본·수정 이력을 보존합니다. **Observe**의 필터와 `node src/cli.js call read examples/read-links.json`으로 초기 응답을 줄일 수 있으며, 같은 관찰의 다음 페이지는 새 수집을 하지 않습니다. 명시 저장은 선택한 읽기 페이지의 URL/문서/관찰/시각/coverage를 포함해 비공개 상태에 보관하고 재시작 후 조회합니다. [읽기·보존 계약](docs/reading.md).

**Check drift**로 현재 역할을 대조하고 편집·재시험합니다. **Preview update**는 변경 필드·권한 추가·영향받는 오버레이를 보여 주며 개인 변경을 덮어쓰지 않습니다. 기반은 판본 해시로 고정됩니다. 전역 기반을 사이트로 좁힐 수 있고 주소/경로·기반 조건은 넓힐 수 없습니다. 개인 기능에 필요한 새 primitive 권한은 시험 결과에서 확인하고 활성화 때 명시적으로 승인해야 합니다. 내보내기는 정의만 포함하지만 선택자·이름·문자열도 공유 전 검토해야 합니다. 가져온 팩은 비활성 초안입니다. [데모](docs/demo.md) · [팩/API](docs/packs.md).

## 현재 한계

- 제한된 light DOM의 문자 Range가 뷰포트·overflow 클립 안에 들어오는지 검사합니다. 접근성 이름은 메타데이터입니다. 픽셀·가독성·시각적 가림을 인증하지 않으며 누락/미확인을 표시합니다.
- 입력은 DOM **합성 이벤트**이며 trusted 네이티브 입력이 아닙니다. 일반 같은 탭 링크, text/search/textarea 입력, 제한된 요소 스크롤만 지원합니다. 폼 제출·임의 버튼·민감한 거래·키 조합·드래그·클립보드는 미지원입니다. 사이트 핸들러의 부작용도 있어 호출자가 안전한 탐색인지 판단해야 합니다.
- 프레임·Shadow DOM·canvas/OCR·복잡한 paint·Nomiya 전체 기능은 미구현입니다. 제품은 headless 브라우저를 실행하지 않습니다.
- 취소는 중단/복구가 아닙니다. lease 뒤 전달 가능성은 unknown이며 후속 단계만 막습니다. 영수증을 조회하고 unknown 입력을 새 ID로 재시도하지 마세요. 재연결은 과거 관찰을 무효화합니다.
- 저장은 단일 런타임 소유입니다. 교체 직전 digest 재검사도 원자적 CAS는 아닙니다. 외부 편집을 지원하지 않으며 조작 원장은 10,000건 한도이고 자동 삭제하지 않습니다. 원격 게이트웨이는 없습니다.

[요구/미완 범위](docs/requirements.md) · [검증](docs/validation.md) · [개발 순서](docs/implementation-plan.md) · [기여](CONTRIBUTING.md) · [보안](SECURITY.md) · [라이선스·출처](THIRD_PARTY_NOTICES.md)

## 0.3.0 · 도착 확인과 명시적 누적 문서

링크 입력은 한 번만 시도하고, 정확한 같은 출처 목적지와 관찰된 도착 조건을 시간·횟수 제한 안에서 확인합니다. 전달 불명 상태를 성공으로 바꾸거나 입력을 재시도하지 않습니다. 명시 저장한 읽기들은 판본·문맥·용량을 검사하는 비공개 문서로 누적하고, 재시작 후 읽거나 출처·무결성 정보를 함께 내보낼 수 있습니다. 일반 편집/관찰 UI와 CLI/MCP가 같은 런타임을 사용합니다. [계약과 사용 예](docs/navigation-and-documents.md) · [원본 API 92개 전체 대응과 미구현 목록](docs/legacy-api-inventory.md).


## Bounded container reading · 0.5.0 / 제한된 컨테이너 읽기

`pageRead` connects a pinned active site pack, filtered current-container reading and guarded synthetic element scroll. Observe → Bounded container reading exposes ordinary role/mode/budget controls, progress receipts and cancellation. Use `packGet.activeEffectiveRevision` with the active revision; `operation` and `cancel` retain the same operation ID. [Contract, CLI/MCP setup and source comparison](docs/page-reading.md), [synthetic pack](examples/container-pack.json), [request template](examples/page-read.json). The example pins the unchanged synthetic fixture; edited definitions need both actual hashes from packGet.

현재 위치에서 제한된 횟수만 읽고 이동하며, 캡처별 출처·범위·offset 변화와 읽기 경로를 보존합니다. 전체 완독·네이티브 휠·자동 저장은 주장하지 않습니다. 원문은 기존 보관 관측에서 읽고 필요할 때만 명시 저장합니다. 감독자가 소스 해시를 대조한 별도 작업본에서 일반 동시 실행 검사81/81·구문·빌드 통과를 확인했습니다. CLI의 MXC 환경에서는 loopback EACCES와 Chrome 시작 실패가 별도로 기록돼 있습니다. 버전0.5.0은 확장 설치·실사이트 통과나 릴리스를 뜻하지 않습니다.
