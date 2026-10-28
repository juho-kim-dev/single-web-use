# Pack and API guide

The authoritative schemas are `src/contracts.js`, discoverable through MCP `tools/list`. CLI invokes the same methods: `node src/cli.js call METHOD request.json`. Requests are strict JSON; unknown fields and reserved object-prototype IDs are rejected.

## Definitions

See `examples/search-pack.json`. A `paw-swu-pack` schemaVersion 1 definition has independent semantic version, ID, origin (null for global read scope), pathPrefix, continuing conditions, roles, permissions and procedures. IDs are bounded ASCII letters/digits/underscore/hyphen, excluding Object.prototype names and `prototype`. Each role has a CSS selector, optional exact accessibility label and extract mode `text`, `link` or `state`. Selectors are evaluated only against bounded current-viewport candidates. Zero matches means not-observed, never absence; multiple matches are ambiguous.

Procedure `parameters` names up to 16 required strings, each at most 4,000 characters. A fill step uses exactly one of literal `text` or named `parameter`. No interpolation, scripts, optional arguments or eval. `packRun.arguments` must contain exactly those names. Inputs are not automatically included in exported packages, but receipts/definitions may contain private strings in local state. Static text is exportable; review it.

```json
{"id":"demo-search","procedure":"fill-query","operationId":"my-query-001","arguments":{"query":"SWU evidence"}}
```

Execution pins active and effective revision hashes plus arguments into the operation digest. An identical retry returns the original receipt even if the active pack later changes. Changed intent with the same ID is rejected. Primitive child operation IDs are derived from that pinned parent; they are not replayed after uncertainty.

Initial `preconditions` run once on the first observation. Continuing `scope.conditions` and exact origin/path apply to every step. Only the current step target must resolve; unrelated/future/postcondition roles may remain unobserved. The last observation checks `postconditions`; unresolved conditions yield unknown. There is no implicit wait/retry for delayed site effects. A locator test can pass when some useful role matches and scope conditions hold; it reports all unresolved roles and does not prove later steps or outcomes.

Condition state `text` uses bounded DOM text; omitted/truncated text is unknown. `value` means current supported native field value; `visible` means DOM hit test, not visual/pixel proof; `enabled` is sampled DOM state. Primitive `act.postcondition.role` refers to its ephemeral target ref; primitive text postconditions remain unknown. Pack conditions refer to persistent role IDs.

## Lifecycle calls

| Method | Arguments / behavior |
|---|---|
| `packs`, `status`, `observe` | `{}` |
| `packPropose` | `{id,name,observationId,target}` → read-only inactive draft |
| `packGet` | `{id}` → revisions, draft/active, locator tests, installed hashes |
| `packDraft`, `packImport` | `{pack,expected}`; expected null for new ID, otherwise current draft hash; import also records installed revision |
| `packTest`, `packActivate` | `{id,revision}`; test acquires NEW observation; activation needs recent passing same-session locator test |
| `packContext` | `{observationId}` → role evidence, drift and cross-pack role conflicts |
| `packRun` | `{id,procedure,operationId,arguments}`; explicit pack selection resolves cross-pack ambiguity |
| `packUpdatePreview` | `{id,pack}` → field conflicts and affected overlays; no write |
| `packExport` | `{id,revision}` → definition only |
| `operation`, `cancel` | `{operationId}`; cancel is not interruption/rollback; after lease possible delivery stays unknown, no retry |

## Personal overlays

An overlay has its own ID/version and `extends:{id,revision}` pointing to an installed base hash. Base must be installed first; nested overlays are unsupported. Roles and procedures merge by ID, with explicit overlay replacement. References are validated against the effective roles. Origin must match exactly, path can only narrow, base scope conditions are retained, and permissions cannot widen. Inherited procedures still need all required effective permissions. To remove an inherited action, replace that procedure explicitly; there is no deletion patch language.

On a shared update, preview changes, save/import a new base draft, test/activate deliberately. Existing overlays keep the original base hash. To migrate an overlay, edit its pinned hash after reviewing field changes, save/retest/activate it separately. No automatic three-way merge or clobber. A personal pack without extends is fully independent. Export bases and overlays separately; importing a lone overlay with a missing base fails cleanly.

## Scope and limits

The six responsibilities are represented in useful small evidence fields: layout rectangles/viewport, exposure hit test, semantics/metadata, supported interaction primitives, states/conditions, and parent/role relations. This is not a full semantic inference engine. Original DOM samples, pack-inferred roles and unknown pixels are labeled; hypotheses are not automatically promoted into active definitions. Cardinality-many logical parts, detailed relations, pack authoring forms, three-way merges, automated procedure-effect testing and pack permission consent policies beyond the primitive guard remain missing scope, listed in requirements.
