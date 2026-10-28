# Single Web Use

**이미 열어 둔 브라우저를 AI가 현재 근거·입력 가드·재사용 가능한 사이트 기능으로 사용하도록 돕습니다.**

[English](README.md) · [구조](docs/architecture.md) · [요구와 상태](docs/requirements.md) · [계승 분석](docs/inheritance.md)

SWU는 **PAW(Personal AI Workspace)**의 브라우저 사용 구성요소입니다. 전경 탭의 현재 뷰포트를 관찰하고 사용자가 정의한 역할을 찾으며 입력 직전에 대상을 다시 검사합니다. 요청 수락·입력 전달·후조건 관찰을 구분합니다. 모델 내장 computer-use나 사이트 자체 도구는 필수 조건이 아닙니다.

기존 SWU의 계약을 이어가는 별도 PAW 구현입니다. Nomiya를 교체하거나 Obsidian 볼트에 설치하지 않으며 저장 형식도 별개입니다. [Juho Kim](https://github.com/juho-kim-dev)이 AI의 도움을 받아 개발합니다.

## 0.1.0 개발 검토 지점

확장–Connector 인증 통신, 제한된 DOM 뷰포트 관찰, 합성 필드 입력·일반 링크 클릭·요소 스크롤, CLI·stdio MCP, 팩 초안/시험/활성화/실행/내보내기/가져오기와 고정 기반 오버레이·갱신 미리보기를 구현했습니다.

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

**Check drift**로 현재 역할을 대조하고 편집·재시험합니다. **Preview update**는 변경 필드와 영향받는 오버레이를 보여 주며 개인 변경을 덮어쓰지 않습니다. 기반 팩은 판본 해시로 고정되고 오버레이는 권한·주소 범위를 넓힐 수 없습니다. 내보내기는 정의만 포함하지만 선택자·이름·문자열도 개인 정보일 수 있어 공유 전에 검토합니다. 가져온 팩은 비활성 초안입니다. [데모](docs/demo.md) · [팩/API](docs/packs.md).

## 현재 한계

- 제한된 light DOM의 문자 Range가 뷰포트·overflow 클립 안에 들어오는지 검사합니다. 접근성 이름은 메타데이터입니다. 픽셀·가독성·시각적 가림을 인증하지 않으며 누락/미확인을 표시합니다.
- 입력은 DOM **합성 이벤트**이며 trusted 네이티브 입력이 아닙니다. 일반 같은 탭 링크, text/search/textarea 입력, 제한된 요소 스크롤만 지원합니다. 폼 제출·임의 버튼·민감한 거래·키 조합·드래그·클립보드는 미지원입니다. 사이트 핸들러의 부작용도 있어 호출자가 안전한 탐색인지 판단해야 합니다.
- 프레임·Shadow DOM·canvas/OCR·복잡한 paint·Nomiya 전체 기능은 미구현입니다. 제품은 headless 브라우저를 실행하지 않습니다.
- 취소는 중단/복구가 아닙니다. lease 뒤 전달 가능성은 unknown이며 후속 단계만 막습니다. 영수증을 조회하고 unknown 입력을 새 ID로 재시도하지 마세요. 재연결은 과거 관찰을 무효화합니다.
- 저장은 단일 런타임 소유입니다. 교체 직전 digest 재검사도 원자적 CAS는 아닙니다. 외부 편집을 지원하지 않으며 조작 원장은 10,000건 한도이고 자동 삭제하지 않습니다. 원격 게이트웨이는 없습니다.

[요구/미완 범위](docs/requirements.md) · [검증](docs/validation.md) · [개발 순서](docs/implementation-plan.md) · [기여](CONTRIBUTING.md) · [보안](SECURITY.md) · [라이선스·출처](THIRD_PARTY_NOTICES.md)
