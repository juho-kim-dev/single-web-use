# Bounded current-container reading · 0.5.0

This connects the inherited bounded read/scroll family to the existing PAW runtime. It is not a whole-page reader, native wheel implementation or automatic capture/export service. Supervisor verification of a hash-matched implementation passed the normal81-test concurrent suite with0 failures/0 skips, syntax and build. Product version is0.5.0. The restricted MXC results remain a separate environment record; no installed/live browser validation or release is implied.

## Request and use

`pageRead` is an input-capable API, available through `swu call pageRead request.json`, MCP and Observe → Bounded container reading. It requires an active origin-scoped pack with read and scroll permissions. Use `packGet.active` and `packGet.activeEffectiveRevision` as the exact pins. The pack's scroll role must resolve to exactly one currently observed, hit-tested, enabled element, with no known truncation. Reading roles must be defined in that same effective pack. The collector must confirm an overflow auto/scroll element's DOM metrics; a missing metric is unknown, not zero or end.

The ordinary popup captures pack, role IDs, modes, operation ID, delta and budgets before awaiting pack lookup. Changed fields stop an unsent request; late results do not replace a different reading intent. Keep the operation ID to inspect progress/final receipt or cancel. A same-ID retry is never a new run. After changed fields or uncertain delivery, inspect the original operation before explicitly creating another intent. CLI/MCP work against the same runtime/state and never start a second owner.

Example request for the unchanged synthetic pack (if edited or overlaid, use BOTH actual hashes from packGet):

```json
{
  "operationId": "reading-demo-1",
  "packId": "container-demo",
  "packRevision": "6c76c5d8b81eaa33681843ab2f3f08eedede59c1a30d4a3aa7456de1b8da73f7",
  "effectiveRevision": "6c76c5d8b81eaa33681843ab2f3f08eedede59c1a30d4a3aa7456de1b8da73f7",
  "scrollRole": "container",
  "read": { "roles": ["content"], "kinds": ["text", "link"] },
  "maxSteps": 2,
  "maxElapsedMs": 10000,
  "maxContentBytes": 65536,
  "dy": 300
}
```

For the synthetic fixture, run `node scripts/demo.js`, open the local demo manually and follow **Open bounded container reading fixture**. Import `examples/container-pack.json` as a draft, test it on the visible fixture and explicitly acknowledge scroll permission on activation. Then confirm the actual pins with packGet; the request example pins the unchanged fixture definition. This setup uses the existing demo server, not a new runtime service. It is not live-site evidence.

Zero additional steps means one capture only. Maximums are 8 scroll attempts, 30 seconds before further input/capture acceptance, and 131072 accepted reading bytes. Time starts before the parent journal write. Disk persistence/cleanup may finish later; browser dispatch cannot be interrupted or rolled back. Capture and input command deadlines are capped by remaining time without changing the runtime's normal timeout.

## Capture and progress contract

Start at the current position. Read one bounded filtered page (maximum100 items) within the observed container's parent chain; compose only already-observed descendant text. No ancestor innerText, nearby card URL, hidden DOM, offscreen scrolling target or page-dimension-as-content substitution. Pagination/omissions remain explicit; a page continuation is a read of the same observation, not another scroll. `maxContentBytes` bounds the sum of serialized accepted reading responses, including their provenance/filter/coverage. A capture that would exceed it is not accepted. An empty within-container selection stops before scroll.

Each accepted capture preserves observation/session/surface/document/generation/exact URL/time/coverage through provenance, the exact revision-pinned read route, content hash/count/byte budget, DOM offset/extent sample, and comparison with the previous capture. The hash compares selected same-ref text/link/state; it is not a cross-node identity inference. Reported delta is observed element scrollTop displacement. Changed selected content and extent are separate facts, not proof that scrolling caused either change. Unchanged offsets stop as no movement, never as whole-page completion. A sampled boundary does not prove finished loading or complete reading.

The same surface/session/document/generation/exact URL, viewport, user-input epoch, container ref and rect must remain compatible. Ref replacement, viewport shift or context change stops rather than merges captures. Scope conditions are rechecked at captures, and the existing synchronous page action guard rechecks target metrics/state/identity immediately before every synthetic scroll. Paused/cancelled/rebound/expired work cannot dispatch another step, including after an awaited durable reservation. Unknown input keeps the fence. No native debugger permission is added.

## Persistence and bounded output

`operation {operationId}` bypasses the work queue for inspectable in-flight progress; `cancel` stops later work and requests cancellation of current read/child act. The final durable parent receipt preserves bounded capture routes/metrics and stripped child input receipts; raw observations and text are NOT copied into the operation journal. Parent report metadata stops before60000 bytes of capture projection (plus bounded final steps/status). The existing10000-operation hard limit covers parents and children. No automatic receipt eviction or replay is added.

Use each `captures[i].reading` method/args to retrieve useful content via `read`. The source observation retains the existing32-capture/16MiB memory limit. After eviction or restart a route may be unavailable; this is explicit, not empty content. A restarted pending parent returns unknown and never resumes. Historical read routes never authorize input. Explicit `contentSave` and the existing document APIs may preserve selected readings separately; nothing here saves or exports them automatically.

## Original-source comparison

Inspected read-only Nomiya `fcfbe5a`: `src/page-read.ts:PageReadRequestSchema,createPageReadReport,runPageRead`; `src/runtime.ts:startPageRead,pageReadStatus,cancelPageRead` (3373–3427); `src/main.ts` dispatch and UI call sites; `docs/API.md` pageRead contract. Nomiya's driver checks a lease/generation, iterates bounded captures/native wheel input and may explicitly save PageDocument files with saveOnStop default true. Its report states `wholePageRead:not-established`; content may include prior accumulated fragments and other regions.

This PAW implementation is independent code, uses DOM-synthetic element scroll, selected within-container retained readings and the existing journal/operation/cancel APIs. It deliberately does not copy the Nomiya host, native wheel ownership or automatic saving defaults. It adds no PageObservation merge engine, gap/replacement inference, native query submission, file migration, renderer/pixel proof or whole-page compatibility claim. No private captures or original conversations are included.
