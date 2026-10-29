# SWU lineage and per-file decisions

Inspected Nomiya source: `CocaPls/swu-nomiya`, local origin/main `fcfbe5a197b688b1640766b67d4d79b6e505f683` (0.17.3). Common PAW main independently confirmed `c831be80249192d2acbeaa01ad0b0b488a970569`. Historical public SWU main API resolved `598770b911b6c4d793c38c54fbd4fcbc5beeb097`. These are analysis inputs, not this project's implementation or live-site evidence.

| Inspected source/path | Actual responsibility | Decision in this derivative |
|---|---|---|
| public SWU `bin/webctl`, `lib/core.sh` | Bash CLI → Obsidian eval, serialized calls, run routing, capture token/polling, page eval | New CLI/runtime. Preserve serialized requests and explicit ownership concepts; reject arbitrary page eval and host-vault coupling |
| public SWU `plugin/CONTRACT.md` | Explicitly proposed, unimplemented plugin; doctor/runs and optional push channel | New actual extension connection; do not count historical proposal as delivered |
| Nomiya `portable.ts` | portable schema validation/context, references, workflow applicability, regrounding | Adapt concepts in `packs.js`; separate definitions from private observations/history |
| `analysis.ts`, `application.ts` | pure injected analysis vs bundled YouTube selection | New independent core/adapter boundary; no bundled site-specific assumptions |
| `guest.ts`, `guest-change-journal.ts`, guest geometry helpers | DOM evidence, mutation journal, bounded geometry/text acquisition | New smaller isolated collector; advanced paint/reading rigor deferred and not claimed equivalent |
| `model.ts`, `snapshot.ts` | contracts, immutable publication, coverage, fingerprints | New strict smaller format, explicit observation IDs and bounded evidence. No implicit compatibility |
| `identity.ts`, `geometry.ts` | exact URL identity vs resource identity; coordinate measurement | New exact URL/document/session + visual viewport stamp. Site resource canonicalization deferred |
| `runtime.ts` | host orchestration, idempotency/cancel, observation ownership | New single Node runtime and durable operation journal; no Obsidian imports |
| `input.ts`, `input-validation.ts`, `target-click.ts` | delivery evidence, semantic/geometry recheck, guarded press | Adapt principles only. Synthetic primitives explicitly differ from Electron native input; no trusted-input claim |
| `structure-action.ts` | role resolution, conditions, guarded navigation/query/reading | New bounded pack procedure executor; advanced structural acquisition/effect models deferred |
| `structure-knowledge.ts`, `structure-knowledge-file.ts` | strict role/regime definitions, version/ref validation, file knowledge source | New portable scoped role packages + personal revisions/overlays; no raw knowledge-file transplant |
| `pack-validation.ts`, `store.ts` | reference validation, revision checks, atomic replacement/backups, external-edit/symlink protection | New runtime-owned content-addressed revision records + atomic state file; external edits unsupported, digest checks detect conflicts within a documented non-atomic boundary |
| `ai-interface.ts`, `docs/API.md` | discovery/contracts, request vs execution result distinctions | New CLI/MCP tools with explicit schemas |
| Chrome `manifest.json`, `guest.ts`, `host.ts` | activeTab observation, document binding, sequential acquisition checks and cleanup | New persistent worker bridge and popup editor; Nomiya observation-only evidence does not establish this adapter works |

Read related architecture, start-here, Chrome and development-tools documents; contract inspection covers evidence/lifetime and command/capability execution, with other contracts sampled for their relevant scope. Large source files were inspected by connected entry points and relevant sections, not every line; deeper advanced paint/input behavior remains unverified here.

Additional inspected product evidence: `CocaPls/vault-izakaya` commit `ef995e8376ced2a7408991fd8ec8c2171c1b36be`, `.obsidian/plugins/webctl-bridge/main.js`, Git blob `775ec70d50ad028a06b78d4c307629721d42590a`, manifest 1.7.0. The supervisor supplied the compiled bundle and a readable transform. Relevant exported sections were read; line numbers refer to the transform, not original source files. This is shipped-code inspection, not recovery of the original TypeScript tree or live-host validation.

| Inspected Izakaya product section | Actual responsibility | Decision here |
|---|---|---|
| `LocalRecordStore`, around 12620 | serialized mutation, lock, checkDisk before/after temporary write, rename, conflict preservation | Adapt principle in StateStore: digest recheck after temp write, atomic rename, single runtime lock. Explicit residual non-atomic CAS boundary; no private adapter copied |
| `MyElementStore` around 12750 and personal-pack store around 12846 | captured element records; `swu.personal-pack.experimental.v1`, service-origin permission, import ID/digest tracking | New definitions-only export with installed revision hashes; no personal capture transplant or implicit compatibility |
| `MyElements` around 13838 | local personal entry management/editor entry points | Target proposal, ordinary author fields, procedure composer and advanced JSON over one runtime; historical UI not copied |
| logical-element contract around 13846 | named parts with selectors and one/many counts, path applicability, present/absent/exposed/hidden conditions, reproduction notes and steps | Bounded single/many-item roles and conditions implemented; grouped multi-part/reproduction contracts still missing. Missing viewport matches never promoted to absent |
| `logicalElementPage` around 14690–14953 | origin/document/path binding, part candidates, structural status and reproduction checks; meaning verification explicitly not automated | Adapt document-bound runtime roles and explicit unverified procedure outcomes; no universal semantic-verification claim |
| `SitePacks` through 16309 | service/site pack selection, origin registration, structural capture and role UI | Separate versioned bases/overlays and current-page proposal; service registry/migration and historical rich UI not ported |

The filtered tree and compiled product do not establish the entire earlier TS/webctl lineage. Sakaba and gen3 direct source bodies remain unavailable/unverified. Personal pack bodies and private captures were not read or copied. Detailed historical completion and format migration remain open; no claim of full inheritance parity is made.

No source code has been copied verbatim in this checkpoint. It is an independent implementation informed by the user's SWU contracts. If later code reuse occurs, add exact source commit/path/license and retained notices before publication. Historical public SWU is MIT; private vault publication permission does not remove third-party obligations.


## Bounded read/scroll · 0.5.0

Nomiya `fcfbe5a` source bodies inspected: `page-read.ts:PageReadRequestSchema,createPageReadReport,runPageRead`, `runtime.ts:startPageRead,pageReadStatus,cancelPageRead`, main dispatcher/UI and API pageRead contract. PAW counterparts: `pageRead`, `operation`, `cancel` → `page-reading.js`, Runtime, existing guarded `act`; tests `page-reading.test.js` and `popup-page-reading.test.js`. This is an independent bounded selected-container implementation using DOM synthetic scroll and existing retained evidence, not transplanted host/native wheel code. Nomiya's `wholePageRead:not-established` is preserved. Auto-saving, previous-fragment/other-region aggregation and native wheel routing are not parity claims; [detailed differences](page-reading.md). Existing92 API inventory entries are retained; pageReadStart/Status/Cancel now have these bounded counterparts. No live-site result is asserted.

한국어 남은 범위: 이 후보는 제한된 현재 영역 읽기/스크롤 진행을 추가합니다. 네이티브 wheel·pointer·hover·drag·keys/검색 제출, 자동 페이지 조각 병합·갭/교체 판정, fingerprint/템플릿/형식 이전/녹화 및 독립 렌더 연구는 여전히 구현할 요청입니다. Sakaba/gen3 원본 미확보와 설치·실사이트 차단은 별개의 증거 한계입니다.
