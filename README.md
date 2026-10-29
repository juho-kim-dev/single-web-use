# Single Web Use

**Let AI work with the browser you already have open—with current evidence, guarded input and reusable site abilities.**

[한국어](README.ko.md) · [Architecture](docs/architecture.md) · [Requirements & status](docs/requirements.md) · [Historical inheritance](docs/inheritance.md)

SWU is the browser-use component of **PAW, Personal AI Workspace**. It observes the foreground viewport, resolves user-authored site roles, rechecks targets before supported input, and separates delivery from observed outcomes. Neither a model's built-in computer-use API nor a website's own tools are required.

This independent PAW derivative continues earlier SWU work. It does not replace Nomiya, install into an Obsidian vault, or share its data format. Developed by [Juho Kim](https://github.com/juho-kim-dev) with AI assistance.

## Development checkpoint · 0.6.0 candidate


Native Chrome sidebar and explicit startup helper are implemented as a0.6.0 candidate. After first pairing, use the packaged Windows launcher and click the toolbar on the intended web tab. The gesture opens the panel immediately and may connect only when safe/ready; paused, fenced or explicitly disconnected work is not resumed automatically. `swu mcp` ensures runtime readiness without opening a browser. [First installation, launch and guard contracts](docs/sidebar-startup.md). Supervisor verification passed100/100 tests, syntax and build, plus isolated real-process cold MCP/concurrent startup. Installed/live behavior and the popup-focus hypothesis remain unverified at this source checkpoint.

Bounded current-container `pageRead` now combines pinned pack definitions, filtered visible evidence and guarded synthetic element scroll, with progress receipts, cancellation and finite budgets. Supervisor checks on a hash-matched copy passed81/81 with0 skips, syntax and build. Restricted MXC integration failures remain recorded separately. [Reading contract](docs/page-reading.md).

Global pause/resume now persists and invalidates queued work/old input evidence without clearing unknown delivery. Packs can be archived, returned inactive or restored to a preserved revision, with fresh test/activation required. [Control and lifecycle contracts](docs/control-and-lifecycle.md).

Implemented: authenticated extension/connector transport, bounded viewport DOM observation, guarded **synthetic** fill/link-click/element-scroll, CLI, stdio MCP, and versioned pack draft/test/activate/run/export/import with pinned personal overlays and update previews.

This increment adds filtered text/link/state reading, bounded many-item roles with same-node title/link evidence, deterministic retained-observation pages, capability discovery, observation read/history/diff, explicit private saved reading after restart, ordinary author fields and deactivation. [Source-backed legacy parity and concrete gaps](docs/legacy-parity.md) distinguish these implementations from native input and render research.

Locally checked on Windows with Node 24.22.1: syntax, build, contract/runtime/storage/HTTP/MCP tests, and a synthetic DOM self-check in installed headless Chrome with an isolated temporary profile. **Extension installation, foreground Chrome integration, real-site usefulness and AI-client interoperability remain unverified.** This is a reviewable development preview, not a browser-store/npm release or an all-sites claim. See [validation](docs/validation.md).

## Install the two units

Prerequisite: Node 22+ and a Chromium extension environment. Windows is the locally tested development environment; other OS/browser installations need validation. No Docker, global helper, native-host registry or account login is required.

### 1. Browser Adapter

```sh
npm ci
npm run check
npm test
npm run build
```

In Chrome, open `chrome://extensions`, enable developer mode, choose **Load unpacked**, and select `dist/extension`. Record this extension's ID. This is a manual development installation. Permissions: `activeTab`, `scripting`, `storage`, and access only to `http://127.0.0.1:47831/*`; no all-sites host permission.

### 2. Agent Connector

From the checkout, substitute your extension ID:

```sh
node src/cli.js init EXTENSION_ID
node src/cli.js start
```

Initialization creates `~/.paw-swu/connector.json` once, without printing the token. `SWU_HOME` can select a private directory outside the checkout. Open that file locally and copy **only its token** into the extension's Connect panel, then **Save token**. Never put it in chat, screenshots, commits or shared logs. On Windows, use your private user profile; POSIX file modes alone do not set a Windows ACL.

On an ordinary HTTP(S) page, open the extension and select **Connect current tab**. Keep that tab active in its focused browser window. Keep the connector terminal running. From another terminal:

```sh
node src/cli.js status
node src/cli.js observe
node src/cli.js call read examples/read-links.json
node src/cli.js packs
node src/cli.js call packRun examples/run-query.json
```

The final command requires an installed, tested and active example pack. [Walk through the demo](docs/demo.md) first. Request files keep parameters out of shell history. Observation output can contain private browsing content: do not publish it.

`npm pack` creates a local archive containing connector source, built extension, examples and skill. `npm install --prefix YOUR_PRIVATE_TOOLS ./ARCHIVE.tgz` installs without global changes; invoke the resulting local `swu` executable. No npm release is published. To update: stop runtime, update source/dependencies, rebuild, reload this extension, confirm its ID, restart/rebind. If the ID changes, [re-pair without deleting state](SECURITY.md).

Connection refused? The popup shows a fixed code with Korean/English manual guidance. See [connection diagnostics](docs/connection-diagnostics.md); a refusal does not identify its underlying live cause until the distinct code is observed.

## MCP and usage skill

MCP startup ensures the same configured runtime is ready, without opening Chrome. Configure a stdio server with an **absolute path**:

```json
{
  "mcpServers": {
    "swu": {
      "command": "node",
      "args": ["C:/YOUR_CHECKOUT/src/cli.js", "mcp"]
    }
  }
}
```

Use your client's supported MCP configuration format. This generic example is not a verified client-specific installation. MCP forwards to the same runtime as CLI/editor; it does not create another store. Install/copy the bundled [usage skill](skills/swu/SKILL.md) through your agent's documented skill mechanism. No settings are changed automatically.

## Make a site ability

1. **Observe → Read now**; select a target to propose a read-only draft.
2. In **Site packs**, edit ordinary fields for pack/name/scope, role/selector/extraction, one/many cardinality and supported fill/scroll/link steps. **Apply fields** changes only an unsaved draft; **Save draft** persists it. Advanced JSON is available for conditions and detailed changes. Named string parameters support fill values and exact repeated-item link selection.
3. **Save draft → Test current draft → Activate tested revision**. A test acquires a new observation and checks available locators. Future roles and procedure outcomes stay unverified. Review any new permissions and explicitly check their acknowledgement before activation. **Deactivate** turns off an exact active revision while preserving its definitions/history.
4. Reuse through CLI/MCP or **Run an active procedure**. Initial preconditions run once; scope and the current target are checked per step; final postconditions are checked last.
5. **Check drift**, then edit/retest. **Preview update** reports changed fields, new permissions and affected overlays. Bases and personal revisions stay separate. A global base may narrow to a site overlay; site/path restrictions and base conditions cannot broaden. Personal new primitive permissions require fresh test and explicit activation acknowledgement, never automatic elevation.
6. **Export definition** to share. Only definitions are exported, but selectors/labels/static strings may still be personal. Import is an inactive draft.

[Pack/API examples](docs/packs.md). Page content and pack descriptions are untrusted data, never authorization for sensitive operations.

Use the Observe filter panel or `read` to choose content modes and optional active pack. Pagination reuses the exact observation, without another browser read. Save a selected page explicitly through **Save this reading page privately**; saved content reloads after runtime restart and never enters pack export. History/diff and saved refs are historical evidence, not current input authorization. See [reading, retention and preservation contracts](docs/reading.md).

## Current boundaries

- Text collection is bounded light DOM with per-character viewport/overflow-clip checks. Accessibility labels are metadata. Rectangles and hit tests do **not** prove pixels, legibility or visual occlusion; omissions remain explicit.
- Input uses DOM synthetic events, not trusted native input. Only ordinary same-tab HTTP(S) links, native text/search/textarea fill and bounded element scroll are supported. No arbitrary button/form submission, key chords, drag, clipboard or sensitive transactions. Site link handlers may still have side effects; callers must know the requested navigation is safe.
- Frames, shadow roots, canvas/OCR, complex paint and full Nomiya capabilities are outside this version. The product does not launch a headless browser; that is only a synthetic test.
- Navigation, user intervention, focus/tab changes and reconnects invalidate assumptions. Unknown delivery fences input until explicit rebind. Cancellation is a request, not interruption/rollback: inspect receipts and never retry unknown input with a new ID.
- One runtime owns the private state directory; the ledger stops at 10,000 operations. External edits are unsupported. Digest checks narrow but cannot eliminate the check/rename race. No automatic evidence upload, telemetry or remote gateway.

[Implementation order](docs/implementation-plan.md) · [Validation](docs/validation.md) · [Ponytail review](docs/review.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [License/provenance](THIRD_PARTY_NOTICES.md)

Historical records, local tests, installation and live-site results are separate evidence classes. No Nomiya demo or missing attachment is presented as evidence for this adapter.

## 0.3.0 · arrival and explicit documents

A navigation procedure can now verify an exact same-origin destination and observed destination conditions under time/count budgets, without retrying input or clearing unknown-delivery fences. Explicit saved reading pages can be accumulated into bounded, revision-checked private documents and reloaded/exported with provenance and integrity metadata. Ordinary editor/Observe controls, CLI and MCP use the same runtime. [Contracts and examples](docs/navigation-and-documents.md) · [all 92 registered legacy commands and remaining gaps](docs/legacy-api-inventory.md).


## Bounded container reading · 0.5.0 / 제한된 컨테이너 읽기

`pageRead` connects a pinned active site pack, filtered current-container reading and guarded synthetic element scroll. Observe → Bounded container reading exposes ordinary role/mode/budget controls, progress receipts and cancellation. Use `packGet.activeEffectiveRevision` with the active revision; `operation` and `cancel` retain the same operation ID. [Contract, CLI/MCP setup and source comparison](docs/page-reading.md), [synthetic pack](examples/container-pack.json), [request template](examples/page-read.json). The example pins the unchanged synthetic fixture; edited definitions need both actual hashes from packGet.

현재 위치에서 제한된 횟수만 읽고 이동하며, 캡처별 출처·범위·offset 변화와 읽기 경로를 보존합니다. 전체 완독·네이티브 휠·자동 저장은 주장하지 않습니다. 원문은 기존 보관 관측에서 읽고 필요할 때만 명시 저장합니다. 감독자가 소스 해시를 대조한 별도 작업본에서 일반 동시 실행 검사81/81·구문·빌드 통과를 확인했습니다. CLI의 MXC 환경에서는 loopback EACCES와 Chrome 시작 실패가 별도로 기록돼 있습니다. 버전0.5.0은 확장 설치·실사이트 통과나 릴리스를 뜻하지 않습니다.


For0.6 automatic connection, the runtime must advertise guarded-auto-v1. A responsive0.5/older incompatible owner returns update/restart-required; the startup helper never kills it, deletes its lock or changes the pairing token. Toolbar binding is finally authorized atomically by the runtime against the observed session, pause/fence/busy state and existing ownership. Source publication remains separate from unclaimed installed/live verification. [R34 sidebar/startup contract](docs/sidebar-startup.md).
