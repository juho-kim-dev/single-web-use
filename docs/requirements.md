# Requirements and evidence map

PAW means Personal AI Workspace: independently usable apps preserve originals and evidence for humans and changing AI callers. SWU is its browser-use component, not a replacement for the workspace or Nomiya. This derivative starts at 0.1.0 with a separate data format.

| ID | Requirement | Implementation / acceptance evidence |
|---|---|---|
| R01 | Use the already open, user-visible viewport | `extension/worker.js`, `extension/page.js`; focused active tab only; live evidence pending |
| R02 | Browser Adapter + Agent Connector installation units | `extension/manifest.json`, `src/cli.js`, `skills/swu/SKILL.md`; build + transport tests |
| R03 | Own observation and action system; no WebMCP/model prerequisite | `src/contracts.js`, `src/runtime.js`, `extension/page.js` |
| R04 | Exportable, installable versioned site abilities | `src/packs.js`, strict `packSchema`; permissions, roles, extraction, procedures, conditions |
| R05 | Personal draft → test → activate → reuse → drift → edit/retest → export/import | `src/packs.js`, `extension/popup.js`; revision-bound fresh test, explicit activation |
| R06 | Shared base and personal overlay; explicit composition/update conflicts | `extends` pins base revision; `packUpdatePreview`; no silent rebase |
| R07 | Surface/session/document/navigation/observation/operation identities | runtime and adapter; stale actions rejected |
| R08 | Fresh visibility, hit test, geometry, state and user intervention checks | page guard; same-surface serialization; action tests |
| R09 | Cancellation, unknown delivery, no blind duplicate input/reconnect retry | persistent operation ledger; transport tests |
| R10 | Separate acceptance, delivery and observed outcome; no causation claim | strict receipts; no postcondition means outcome unknown |
| R11 | Immutable observations; not observed ≠ absent | detached stored records, bounded coverage and extraction states |
| R12 | Six analytical responsibilities | layout: rect/viewport; exposure: hit test; semantics: tag/label/role; interactions: supported primitives; conditions: states; relations: parents/roles. DOM original, inferred roles, unknown pixels distinguished |
| R13 | Bounded useful content, no arbitrary page evaluation | fixed packaged page function, 300 nodes/12,000 scan bound; packs are JSON only |
| R14 | Catch up earlier persistent roles/site knowledge and guarded operations honestly | per-file inheritance table; advanced Nomiya capabilities explicitly deferred |
| R15 | Public English/Korean docs, setup, examples, architecture, contribution/security/limitations, version/notices | README companions, docs, example, LICENSE, THIRD_PARTY_NOTICES |
| R16 | Local complete path first; no exposed insecure remote listener | literal loopback bind, Host/Origin/extension identity + bearer checks; remote gateway deferred |
| R17 | No credentials/captures auto-export; untrusted site content cannot authorize actions | export contains definitions only; sensitive controls and non-navigation clicks refused |
| R18 | Real Chrome tests and real sites separate from local checks | `docs/validation.md`; supervisor-assisted extension loading needed if unavailable |
| R19 | No remote writes/Actions/auth changes | no workflows; supervisor publishes; local commits include `[skip ci]` |
| R20 | Actual code/historical comparison and provenance | `docs/inheritance.md`; inspected commits/paths, inaccessible lineage marked unverified |

An implementation link does not mean live verification. See validation for actual executed checks and remaining limitations.

## Concrete checkpoint status and remaining scope

| Requirement IDs | Implemented / locally tested evidence | Missing or unverified scope |
|---|---|---|
| R01–R03, R16 | `test/transport.test.js`: actual authenticated HTTP bind/poll/reply; `test/cli.test.js`: real CLI/MCP subprocesses share runtime; manifest/build | Extension loading/pairing, activeTab grant, Chrome Origin behavior, MV3 suspension/reconnect and actual foreground integration are unverified. No packaged store installer/updater or remote gateway |
| R04–R06 | strict contracts; independent packs, pinned overlays/inherited roles; named parameters; single/many extraction; ordinary author fields and advanced JSON; global→site narrowing, explicit added-permission acknowledgement, deactivation; `packs.test.js`, `reading.test.js`, `review-regressions.test.js` | No grouped multi-part relation editor, three-way merge, automatic base dependency bundle, legacy-format migration or procedure-effect test runner. Locator tests do not prove future roles/effects |
| R07–R11 | durable IDs/receipts; immutable observation read/history/diff; explicit bounded saved content across restart; known pre-dispatch refusals vs unknown possible delivery; Node/HTTP/browser/worker regressions | No trusted native input, rollback or interruption after lease. Power-loss durability and all focus/navigation races not proven. Raw history is32 records/16MiB memory; selected explicit saved pages are separate |
| R08, R12–R13 | `test/browser.test.js` runs synthetic headless installed Chrome: clipped/viewport-bounded text, metadata split, sensitive/hidden/offscreen exclusions, fill, duplicate and mutation refusal; six responsibilities represented explicitly | No pixel/OCR/paint/visual-occlusion proof, frames/shadow roots/canvas, generalized semantic/hypothesis engine, complex relations, drag/keyboard/clipboard or full Nomiya parity. Whole-page negative/absence claims remain unsupported |
| R14, R20 | relevant Nomiya source/contracts, Bash/JS and Izakaya per-file decisions; [API-family parity](legacy-parity.md) maps exact functions to new paths/tests and missing functions | Sakaba/gen3 direct bodies unavailable; full TS lineage/migration and all-source audit incomplete. Native pointer/keys/hover, wheel routing, arrival waiting, accumulated PageDocument and render research are concrete missing rows, not silently dropped requirements |
| R15 | bilingual README, setup, architecture, demo fixture, examples, contribution/security/license/provenance, usage skill; package dry-run | No fake screenshots, benchmarks or live demos. Foreground editor visual/accessibility QA, actual agent-client adoption, public publication/release and non-Windows support remain unverified |
| R17 | definitions-only export; strict primitive permissions and sensitive control refusal; tests for unknown fields/prototype IDs | Ordinary links can have site-defined side effects; no universal sensitive-operation detector or trusted-site policy framework. Users must authorize a safe task; pack text alone cannot grant permission |
| R18–R19 | local checks only; no extension installation/real-site trials/remote writes/Actions performed by this worker; exact commit handed to supervisor | Supervisor must install/pair and independently validate read/search/navigation from bookmarked/Google home, preserve tabs/settings and publish only reviewed sanitized files |

Supervisor corrections have direct regressions: bounded text (`browser.test.js`), initial vs continuing conditions and parameters/pinned digest (`review-regressions.test.js`), inherited references/selectors, parent ledger/prototype IDs, concurrent edit during callback, cancellation of leased child and worker binding race (`worker.test.js`). These are local implementation checks, not live-site results.

## Second increment acceptance mapping · 0.2.0

| ID | Requested behavior | Source / local evidence / current status |
|---|---|---|
| R21 | Configurable initial filtered reading and capability discovery | `Runtime.read/capabilities`, readOptions, MCP/editor filter; `reading.test.js`; implemented/local pass, live blocked |
| R22 | Bounded many-item same-node text/link/state, no mixed cards, deterministic pages | `reading.js`, ordered collector segments/stable refs, role cardinality/extract and own-href navigation parameter; `reading.test.js` + actual synthetic Chrome nested-span check; no full-site/paint claim |
| R23 | Immutable retained observation read/history/diff with compatibility checks | Runtime retained methods + `diffObservations`, 32/16MiB bounds; tests for detached copies, changed/no-longer-observed and cross-document refusal; memory only, no input permission |
| R24 | Explicit bounded private preservation/reload with provenance | contentSave/List/Read in same StateStore, 64/8MiB/512KiB bounds, restart/limits/export-separation tests; selected page only, no unlimited capture or accumulated PageDocument |
| R25 | Ordinary role/scope/procedure fields, exact revision testing, active/draft status, drift/conflicts, deactivate | `extension/editor.js`, popup fields and runtime APIs; draft transform + lifecycle tests; actual extension visual/accessibility QA remains blocked/unverified |
| R26 | Important legacy API families with exact functions, implementation and gaps | [legacy-parity.md](legacy-parity.md), inspected read-only Nomiya `fcfbe5a`; code presence distinct from historical/live success |
| R27 | New personal ability on shared read base, explicit permission acknowledgement, global→site narrowing | Packs.compose/addedPermissions/recordTest/activate/preview, popup overlay/permission controls; read-only base retained unchanged, scope widening and condition-role replacement still rejected; `reading.test.js` |
| R28 | Known pre-injection refusal vs possible execution | worker.execute phase flag; missing binding/focus/disconnect → not-sent, scripting invocation/post-failure → unknown; `worker.test.js`; no silent focus takeover |

Remaining functionality and blocked live verification are separated by API family in the Korean summary at the end of the parity table. No broad deferral statement substitutes for that mapping.

## Independent repair acceptance · successor to c7ff956

The fresh5ce8ee8 failure (23/25, readiness race plus after-test persistence rejection) is preserved in review/validation. The repaired normal concurrent suite and two simultaneous full-suite load runs pass43/43 each, without forced serial files, skipped tests or production timeout/no-retry changes.

R21/R22 continuations now pin observation + stored/effective definition revision, including context/draft-test entry points. Offset6400 was already implemented; a900-item regression proves continuation beyond300. R25 overlay creation uses the real helper with empty own predicates; all8 inherited constraints remain once. Conditions cannot use clipped/ambiguous witnesses: totalObserved2/limit1 stays unknown; duplicate href beyond limit stays blocked, with discovery reporting truncation. Public context/test results use bounded summaries/ref samples, explicit coverage, pinned read routes and byte/count refusal, without repeated raw nodes. Saved/historical reads remain definitions-independent and never current input authority. Missing legacy families and installation/live verification are not marked complete.
