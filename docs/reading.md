# Filtered reading, historical evidence and explicit preservation

All calls use the same runtime through `swu call METHOD request.json`, stdio MCP or the extension editor. Source schemas: `src/contracts.js`; projection: `src/reading.js`; storage: existing `StateStore`. No page eval, offscreen scraping, new service or monitoring scheduler is introduced.

## Initial filtered read and same-observation pages

`read` accepts optional `observationId`, `packId`, `roles`, `kinds:[text,link,state]`, `within` observed ancestor ref, `offset` (0–6400), `limit` (1–100) and `maxBytes` (1024–524288, default32768). Without an observation ID it collects once; subsequent `continuation` carries the original ID and same filter. `observe:{read:{...}}` also filters the initial response while retaining the raw immutable observation for explicit authoring/diagnostics.

Pack reading requires an active read permission, matching origin/path and confirmed continuing scope conditions. `extract` determines each role's returned value; `kinds` can further exclude a mode. Without a pack, kinds apply to bounded viewport candidates. A missing `within` ref or unknown role is an error, not an empty confirmed region. Role labels and scope/location names are metadata, not visible text evidence.

Roles default to `cardinality:one`. Multiple matches are ambiguous and no arbitrary first item is selected. `cardinality:many` returns up to the role's `limit` (1–100, default50), in observation order. Status includes observed count and truncation; it does not claim the whole site's list was scanned. Empty means not-observed, never absent. `packContext` extraction previews ten items per role and supplies a reading continuation for more.

Each item keeps its own role node's ref, document/observation IDs, metadata, exposure and value. A link's href comes **only from that same node**. Its title/text may compose bounded text segments from descendants connected through observed parent refs. Segment order and source/parent/evidence refs are retained. No whole innerText, hidden DOM recovery, metadata-as-title fallback, nearby text borrowing or another card's URL substitution. A container without its own href returns null rather than borrowing a child/nearby href. Geometric text evidence still does not prove pixels, visual occlusion or legibility.

Pages project only the selected items, under byte/count bounds. An oversized first item reports `item-exceeds-byte-budget` with the same offset; change the filter/root or budget, not blind-repeat the same call. The byte budget counts item JSON; envelope/provenance overhead is additional. Every page is historic-at-capture and has `inputPermission:false`.

## Discovery

`capabilities:{purpose:read|act|manage|all,observationId?}` returns purpose-based command names, available synthetic primitive support/limits and active pack procedure argument JSON Schemas with blocked reasons. It does not collect a page automatically. Applicability is checked only against the provided retained observation; fresh foreground guards still own actual input. Global action libraries require a site overlay to execute. Neither advertised support nor locator test means a site accepted an input.

Many-item navigation declares a click step's `linkParameter` among its named string parameters. Execution requires exactly one currently observed matching own href. Duplicate, missing or truncated target search is withheld. It does not navigate directly to the argument URL, choose the first card or infer arrival success.

## Observation read/history/diff

`observationRead:{observationId}` returns a detached retained copy. `observationHistory:{}` lists the retained capture identities/provenance. Limits: 32 observations, 16MiB total memory, 2MiB per observation; oldest captures evict first. Rebinding preserves historical reading while invalidating live action assumptions. Runtime restart ends this in-memory history.

`observationDiff:{before,after}` requires identical surface/session/document/navigation generation/exact URL. Stable isolated-world element refs establish same-document correspondence; recreated nodes get new refs. Changed fields, newly observed and no longer observed are separate. Different documents/sessions/URLs are rejected. No deletion, cause or current-input permission is inferred; both coverages are included.

## Explicit private content

`contentSave:{observationId,name,read:{...}}` explicitly saves **one selected filtered page**, its exact URL/origin, document/session/surface/generation, observation ID/time and coverage. It does not silently save the rest of the pages or an entire site. `contentList:{}` and `contentRead:{id}` work after restart. A saved source continuation can only query the source observation while that observation is still retained; it is not a durable continuation archive.

Saved entries have new immutable IDs, max64 entries, max512KiB per entry and max8MiB aggregate content. Reaching a bound fails without deleting older evidence. There is no automatic capture, overwrite, eviction, external upload or pack embedding. State-directory single-owner/non-atomic check+rename limitations remain in SECURITY.md. Locator tests now persist only validation metadata/ref IDs, not a growing automatic archive of full reading text.

Saved evidence never repopulates current input refs after restart. Current observation, historical retained captures, reusable definitions and explicitly saved selected content remain distinct. Saved content can contain personal data; keep it private and outside Git. `packExport` returns only definitions.
