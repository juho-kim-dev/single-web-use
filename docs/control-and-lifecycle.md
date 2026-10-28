# Pause and preserved pack lifecycle · 0.4.0

`pause({paused:true})` immediately blocks new browser collection/input in memory, cancels registered work and invalidates queued requests plus old input references. It persists the setting in the same private StateStore. Historical reading, saved documents and pack management remain available. An unleased action becomes not-sent; a leased action may already have occurred and remains unknown/fenced. Pending observation is interrupted. This is not rollback, a native key-release implementation or proof that browser code stopped.

`pause({paused:false})` persists the explicit resume before allowing new browser work. It never replays queued work or clears an unknown-delivery fence. Obtain fresh observation; inspect uncertain prior receipts before an explicit rebind. Binding does not clear a persisted pause. Restart restores pause, while previous input evidence remains invalid. If pause persistence fails, the current process stays paused but cannot claim the setting will survive restart. A later explicit successful pause/resume is required to persist it. Status and capability discovery expose pause separately from connection/fence.

The Connect panel provides pause/resume controls. CLI uses `swu call pause request.json`; MCP exposes the same boolean schema. The controls govern this local runtime only, not unrelated applications or browser activity by the user.

| API | Exact request and effect |
|---|---|
| `packArchive` | `{id,expected,expectedActive}` checks the current draft and active revision, marks archived and clears its active pointer. All definitions, original creation times, imports and history remain. |
| `packUnarchive` | `{id,expected}` returns an archived pack as inactive. Clears old locator tests and requires a new observation/test and explicit activation. |
| `packRestore` | `{id,expected,revision}` chooses an existing immutable revision as inactive draft. Preserves all versions, clears old tests and requires fresh test/activation. A conflicting current draft is never overwritten. |

Archive blocks editing/testing/activation until unarchive. It does not erase definitions needed by separately active pinned overlays or silently switch those overlays off. Historical exact-revision reading/export remains available. List/load show archived state. The editor refuses lifecycle actions on unsaved edits and provides a stored-revision chooser. No operation changes the live website or reinstalls original Nomiya data.

Inspected Nomiya `store.ts` at `fcfbe5a` moves an exact-current pack file on archive and restores its previous backup on restore. PAW keeps the existing immutable version map and offers explicit revision selection instead. This is a corresponding lifecycle responsibility, not binary/file-format/API compatibility. No legacy migration is inferred.

Local regression coverage includes pause persistence/restart, historical read availability, queued and already-leased work, fast pause/resume, storage failure, archive conflicts, preserved pinned bases and fresh validation after revision restore. Real extension interaction, process termination/power loss and actual-site usefulness remain unverified.
