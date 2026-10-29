# Architecture and decisions

Two installations: unpacked Chromium Browser Adapter, and a Node Agent Connector containing the runtime, CLI, stdio MCP server and usage skill. One explicitly started runtime owns browser binding, observations, operations, drafts, tests, installed revisions and activation. CLI/MCP/popup call that same runtime; no per-client pack stores.

```mermaid
flowchart LR
  CLI --> Runtime
  MCP[stdio MCP] --> Runtime
  Popup[Extension editor] --> Runtime
  Runtime[Loopback runtime + private state] <-->|authenticated command lease| Worker[Extension worker]
  Worker -->|document-bound packaged function| Page[Already open foreground tab]
```

## Transport choice

Authenticated loopback HTTP is chosen for this first local version. It avoids per-browser native-host registry/manifest installation and works with an unpacked extension. Native Messaging would provide a browser-enforced extension allowlist and no TCP listener, but adds host-registration and process ownership complexity. This choice is reversible. No remote gateway is provided.

The server binds only 127.0.0.1. Host must match the configured literal address/port. Browser requests must have the configured chrome-extension Origin and identity header, plus an unguessable bearer token; website Origins, null Origins and preflights from other sites are rejected. Local CLI requests have no Origin and need the same token. No cookie authentication, wildcard CORS, external extension messaging, URL tokens or page bridge. Browser identity headers are not an OS-local security boundary: local code with the secret can impersonate the client. Protect the private data directory with OS permissions. Pairing values are kept in a private file and extension local storage, never emitted by status or examples.

An explicit popup bind chooses one tab. Rebinding or reconnect changes the runtime session and invalidates observations. Worker restart requires a new bind. Commands receive one lease; timeouts become unknown, never automatically redelivered. Operation IDs persist before delivery. Restart preserves receipts but invalidates browser evidence; pending receipts become unknown. Same-surface work is serialized. An unresolved action fences further input until explicit browser rebind.

## Observation and action

The isolated-world collector visits bounded light DOM, returns current-viewport text and controls, rectangles, semantic labels, states and parent relations. Hit testing proves DOM routing at one point, not pixel visibility or text legibility. Frames, closed shadow DOM, canvas and unsupported paint remain unknown. Native password and sensitive form values are omitted. The adapter verifies active foreground tab/window and Chrome documentId around observation.

Actions are limited to synthetic native-field fill, DOM click on ordinary same-tab HTTP(S) links, and bounded element scroll. This is not trusted OS input. Every action carries the original observation, document, revision, user-input epoch, URL, viewport and target signature. A synchronous guard immediately precedes dispatch. DOM mutations, scroll/resize, navigation, trusted page input and stale age invalidate evidence. No automatic click on submit/delete/purchase controls; packs cannot elevate primitive permissions. Fill requires exact expected value and supports ordinary text/search fields only. Results separate accepted, not-sent/synthetic-dispatched/unknown, and observed/not-observed/unknown outcome. Neither ACK nor subsequent observation proves causation.

## Packs and evidence

Strict versioned JSON packages describe origin/global and path/condition scopes, semantic roles with bounded selectors, extraction, permissions, procedures and pre/postconditions. Definitions contain no scripts or captures. Global definitions may read; action procedures require a specific origin. Selectors locate only currently observed nodes and ambiguous matches are withheld. Multiple matching packs remain separate and conflicting role IDs are reported, never silently ranked.

Drafts are immutable content-addressed revisions. Locator tests acquire NEW evidence for that draft and persist validation metadata/ref IDs, not a growing archive of page text. A useful matched role and satisfied scope are required; future roles/outcomes remain unverified. Activation is explicit. A global base may narrow to a site; specific origin/path/base conditions cannot broaden. New primitive permissions appear in preview/test and require activation acknowledgement. Ordinary author fields create an unsaved draft; test/activate reject unsaved edits. Deactivation preserves definitions/history. Export remains definitions-only.

Procedures accept at most 16 named strings of at most 4,000 characters, substituted as complete fill values without interpolation/eval. The durable intent binds arguments and pinned active/effective revision hashes. Initial preconditions run once; continuing scope and the current step target are checked per step; final postconditions run last. Unrelated/future roles need not be visible initially. After-lease cancellation returns possible-delivery unknown, fences input and stops later steps; it cannot interrupt already executing browser code. Worker snapshots session/binding and checks them after awaits.

Text acquisition never reads whole container innerText. A bounded light-DOM text pass assigns text to the nearest selected owner, tests per-codepoint Range rectangles fully within the viewport and ancestor overflow clips, and omits hidden/sensitive/unsupported effects. Metadata labels remain separate. Budgets/omissions are explicit; text without complete local evidence cannot satisfy a text condition. This is geometric DOM sampling, not pixel reading or visual-occlusion verification.

State writes recheck the original disk digest after the temporary file has been written/synced and immediately before rename. This narrows but does not eliminate concurrent external-edit races: digest-check + rename is not atomic CAS. One runtime owns the directory; external editing is unsupported. Conflict leaves current in-memory definitions and the editor draft available for recovery. The persisted ledger stops at 10,000 records for parents and primitives; no unsafe receipt eviction/replay is hidden in pruning.

## Reading and historical evidence · 0.2.0

`reading.js` projects immutable captured material. Stable collector element refs and ordered bounded text segments support same-role descendant composition and same-document diffs without another DOM read. Extract/cardinality and explicit filters determine payload; pagination projects only its page under count/byte limits. Missing, ambiguous and truncated results remain explicit. Many-item navigation requires exactly one matching own href argument, without borrowing another card's URL.

History is limited to32 captures/16MiB (2MiB each). Rebinding preserves historical reading while live session guards invalidate old inputs. Diffs require same surface/session/document/generation/URL. Explicit content pages use the existing private StateStore (64 entries/8MiB total/512KiB each), survive restart and never repopulate input refs. Ordinary observation collects active effective selectors only; packTest alone adds its draft selectors. [Reading contracts](reading.md) and [parity](legacy-parity.md) give exact scope.

## Arrival and documents · 0.3.0

An optional final-click arrival rule uses bounded observation through the existing serialized runtime and keeps arrival evidence separate from input delivery/fences. `ReadingDocuments` reuses StateStore for explicit same-context sections, revision-bound append, verified historical retries and escaped content export. CLI/MCP/popup share the strict API contracts. Popup retry identities persist separately in extension-local storage before append dispatch; they confer no input authority. [Contracts and limits](navigation-and-documents.md) and the [92-command legacy inventory](legacy-api-inventory.md) describe exact scope and omissions.

## Control and pack lifecycle · 0.4.0

Global pause has an immediate in-memory gate plus a serialized persisted setting in the same StateStore. Request/capture epochs prevent queued work and late replies from regaining input authority after resume. Existing cancellation and unknown fences remain. Archive and revision restoration operate on preserved pack definitions, never page state; pinned overlays retain their exact base. [Contracts](control-and-lifecycle.md).

## External references

Chrome supports document-targeted packaged functions with activeTab/scripting ([official scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting)). MCP uses newline-separated JSON-RPC on stdio ([official transport specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)). Supported protocol versions are explicit in the connector; client interoperability requires actual testing.


## Bounded container reading · 0.5.0

`page-reading.js` orchestrates the existing serialized Runtime observation/read/act paths with pinned effective definitions and a parent durable journal entry. `operation` reads bounded ephemeral progress outside the work queue; final receipts store routes/metrics, not raw content. Child scroll IDs derive from parent request digest/step, so cancel/pause targets the same in-flight family. An internal act guard rechecks deadline/pause epoch after reservation. Collector scroll samples are optional DOM geometry metadata, not reading content or native routing proof. See [the full contract](page-reading.md).

## Sidebar and explicit readiness · 0.6.0 candidate

The Browser Adapter's existing popup.html becomes a native sidePanel path with no default_popup. A direct toolbar gesture opens it before awaits, then conditionally reuses connectTab/foreground for that clicked tab. Manual panel requests identify their own Chrome window. Switching tabs/restarting never auto-binds; explicit disconnect remains in session storage until manual connect. A visible-only status controller reads the same runtime without overlapping requests and ignores hidden/unloaded results. Advanced button disclosures retain original authoring/evidence controls; no arbitrary evaluation or chat engine is introduced.

The Connector gains ensureRuntime/start around its existing authenticated status and exclusive runtime.lock. Node spawn uses absolute executable/CLI arguments without a shell; competing serve processes still arbitrate using the same wx lock, and nonready/stale locks are not deleted. MCP ensures readiness without Chrome; only explicit start --browser uses fixed installed Chrome candidates and Google-home argv. This preserves the two installation units and one state owner, not a claim of exactly two processes. [Full contract and limits](sidebar-startup.md).


Automatic binding is a strict bridge variant carrying intent:automatic and observedSession. Runtime.bind checks pause/fence/queued or in-flight work/session/owner synchronously before any disconnect or fence reset; explicit manual bind retains recovery behavior. Runtime status advertises guarded-auto-v1 and the readiness helper refuses an incompatible responsive owner without touching its lock/config. Panel connected/current requires a matching nonempty adapter-local session/binding and a fresh own-window foreground check. Initialization failure cannot prevent panel controls/polling from registering, and recovered connection errors do not erase unrelated editor failures.
