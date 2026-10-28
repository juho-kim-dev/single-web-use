# Single Web Use

**Let AI work with the browser you already have open—with current evidence, guarded input and reusable site abilities.**

[한국어](README.ko.md) · [Architecture](docs/architecture.md) · [Requirements & status](docs/requirements.md) · [Historical inheritance](docs/inheritance.md)

SWU is the browser-use component of **PAW, Personal AI Workspace**. It observes the foreground viewport, resolves user-authored site roles, rechecks targets before supported input, and separates delivery from observed outcomes. Neither a model's built-in computer-use API nor a website's own tools are required.

This independent PAW derivative continues earlier SWU work. It does not replace Nomiya, install into an Obsidian vault, or share its data format. Developed by [Juho Kim](https://github.com/juho-kim-dev) with AI assistance.

## Development checkpoint · 0.1.0

Implemented: authenticated extension/connector transport, bounded viewport DOM observation, guarded **synthetic** fill/link-click/element-scroll, CLI, stdio MCP, and versioned pack draft/test/activate/run/export/import with pinned personal overlays and update previews.

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
node src/cli.js serve
```

Initialization creates `~/.paw-swu/connector.json` once, without printing the token. `SWU_HOME` can select a private directory outside the checkout. Open that file locally and copy **only its token** into the extension's Connect panel, then **Save token**. Never put it in chat, screenshots, commits or shared logs. On Windows, use your private user profile; POSIX file modes alone do not set a Windows ACL.

On an ordinary HTTP(S) page, open the extension and select **Connect current tab**. Keep that tab active in its focused browser window. Keep the connector terminal running. From another terminal:

```sh
node src/cli.js status
node src/cli.js observe
node src/cli.js packs
node src/cli.js call packRun examples/run-query.json
```

The final command requires an installed, tested and active example pack. [Walk through the demo](docs/demo.md) first. Request files keep parameters out of shell history. Observation output can contain private browsing content: do not publish it.

`npm pack` creates a local archive containing connector source, built extension, examples and skill. `npm install --prefix YOUR_PRIVATE_TOOLS ./ARCHIVE.tgz` installs without global changes; invoke the resulting local `swu` executable. No npm release is published. To update: stop runtime, update source/dependencies, rebuild, reload this extension, confirm its ID, restart/rebind. If the ID changes, [re-pair without deleting state](SECURITY.md).

## MCP and usage skill

Keep the same runtime running; configure a stdio server with an **absolute path**:

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
2. In **Site packs**, edit strict JSON: origin/path/conditions, roles/selectors/extraction, permissions and procedures. Fill steps accept bounded named string parameters.
3. **Save draft → Test current draft → Activate tested revision**. A test acquires a new observation and checks available locators. Future roles and procedure outcomes stay unverified. Activation is explicit.
4. Reuse through CLI/MCP or **Run an active procedure**. Initial preconditions run once; scope and the current target are checked per step; final postconditions are checked last.
5. **Check drift**, then edit/retest. **Preview update** reports changed fields and affected overlays. Bases and personal revisions stay separate; overlays pin their base hash and cannot widen its permissions or scope.
6. **Export definition** to share. Only definitions are exported, but selectors/labels/static strings may still be personal. Import is an inactive draft.

[Pack/API examples](docs/packs.md). Page content and pack descriptions are untrusted data, never authorization for sensitive operations.

## Current boundaries

- Text collection is bounded light DOM with per-character viewport/overflow-clip checks. Accessibility labels are metadata. Rectangles and hit tests do **not** prove pixels, legibility or visual occlusion; omissions remain explicit.
- Input uses DOM synthetic events, not trusted native input. Only ordinary same-tab HTTP(S) links, native text/search/textarea fill and bounded element scroll are supported. No arbitrary button/form submission, key chords, drag, clipboard or sensitive transactions. Site link handlers may still have side effects; callers must know the requested navigation is safe.
- Frames, shadow roots, canvas/OCR, complex paint and full Nomiya capabilities are outside this version. The product does not launch a headless browser; that is only a synthetic test.
- Navigation, user intervention, focus/tab changes and reconnects invalidate assumptions. Unknown delivery fences input until explicit rebind. Cancellation is a request, not interruption/rollback: inspect receipts and never retry unknown input with a new ID.
- One runtime owns the private state directory; the ledger stops at 10,000 operations. External edits are unsupported. Digest checks narrow but cannot eliminate the check/rename race. No automatic evidence upload, telemetry or remote gateway.

[Implementation order](docs/implementation-plan.md) · [Validation](docs/validation.md) · [Ponytail review](docs/review.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [License/provenance](THIRD_PARTY_NOTICES.md)

Historical records, local tests, installation and live-site results are separate evidence classes. No Nomiya demo or missing attachment is presented as evidence for this adapter.
