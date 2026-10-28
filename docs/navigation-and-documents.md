# Arrival evidence and accumulated reading · 0.3.0

These extend the existing connector, pack editor, CLI and MCP. They do not install another host or increase browser permissions. Local tests are not foreground/live-site evidence.

## One navigation, then bounded observation

A procedure may add an optional `arrival` object with `conditions` (1–8 destination-role conditions), `maxObservations` (1–8) and `maxElapsedMs` (100–10000). Its final step must be a link click, with ordinary `postconditions` empty: source preconditions/scope and destination conditions have different lifetimes. Existing definitions without this field retain their canonical revision.

The expected destination is the exact current href on the uniquely selected observed link. It must be a different canonical HTTP(S) URL on the same origin, without username/password. Query bytes and duplicate parameters are preserved; redirects, query omission rules, cross-origin grants, native Enter/search submission and raw URL navigation are not implemented by this contract.

After at most one click attempt, arrival observes the same bound surface. A same-document route or new document can arrive. Exact destination **and** unambiguous observed destination conditions are required; URL equality alone is insufficient. The original source-page scope is not applied to destination roles. The receipt keeps each received observation's ID/document/URL/time, including records excluded by a late deadline, cancellation or changed binding. Counts and command deadlines bound the read loop. There is no watcher or automatic input retry.

`arrival.status` is `arrived`, `unconfirmed`, `unexpected-destination` or `interrupted`. It is separate from the original `delivery`. Even an arrived page never turns unknown delivery into certain delivery, proves causation or clears its input fence. Cancellation interrupts pending arrival reads and cannot undo the preceding click. A rebind during durable input reservation now produces `not-sent` before any command can target the new binding.

Ordinary author fields can add a destination role/selector, optional exact text and budgets to a navigation procedure. Saving/testing/permission acknowledgement/activation remain separate. Blank arrival fields preserve an existing rule; advanced JSON can remove it explicitly. [Synthetic demo pack](../examples/navigation-arrival-pack.json) uses the existing local demo's `/reading` link and heading. Import/test/activate it, then [run its procedure](../examples/run-arrival.json). This is an example, not an executed live demonstration.

## Explicit reading documents

First preserve a selected `read` page with `contentSave`. Then:

| API | Request and behavior |
|---|---|
| `documentCreate` | `{id,name,contentId}` creates from one saved page. Repeating the same creation returns the current summary; reusing its ID for different input conflicts. |
| `documentAppend` | `{id,expected,appendId,contentId}` appends a saved section with the exact expected document revision. A retry must preserve all original intent fields. The previous receipt is reconstructed from verified immutable sections, including after later appends. |
| `documentList` | Lists integrity-checked summaries after restart. |
| `documentRead` | Returns the bounded original sections and their provenance, revisions and coverage. It never repopulates current observation/input references. |
| `documentExport` | Explicitly returns one portable JSON bundle containing escaped Markdown, exact UTF-8 metadata text and a SHA-256/byte-count manifest. |

The document identity condition is exact URL, surface, session, collector document ID and generation. A reload/rebind or another URL requires a separate document. Different filters and repeated/changed sections from the same context remain distinct and ordered; no guessed correspondence, replacement, deletion or whole-page completeness is inferred. Each reading retains source observation/time/filter/coverage. Append IDs support safe request retries, not automatic deduplication of overlapping page content.

Limits: 16 documents, 64 sections/document, 2MiB/document and 8MiB total document storage; export response at most 4MiB. Existing selected-content bounds remain separate. A conflict or exceeded bound preserves the previous revision. There is no automatic pruning or background capture. This increment does not yet provide archive/delete or bounded automatic scroll-and-read.

The Observe panel exposes create, choose, append, reload and explicit bundle export. It captures selection and source content before awaits; late responses cannot append to a newly selected document. CLI uses `swu call METHOD request.json`; MCP exposes the same strict schemas. `documentExport` is a content export, separate from `packExport` definitions. No connector token, pack store or operation ledger enters the bundle. Observed URLs and text may still be private: inspect before sharing. The UI downloads a local JSON bundle; it never publishes it to GitHub.

The common extension worker serializes popup append/reload operations and saves append intent in extension-local storage before dispatch, keyed by document/content. Selection changes and closing/reopening the popup retain the original ID and expected revision. Repeating that pair retries the same request; intentionally adding the same saved content twice requires distinct explicit CLI/API append IDs. A successful explicit reload resets only definite revision conflicts after pending sends settle. Unknown responses never reset automatically. The retry table stops at1024 entries without eviction. Clearing extension data/uninstalling loses these client identities; inspect the document before attempting another append in that case.

Manifest hashes cover the exact `markdown` and `metadata` strings encoded as UTF-8. `metadata` is deliberately a string so reformatting cannot silently change verified bytes. On read/export, stored document/section hashes are checked. These checks detect corruption; they are not signatures or protection against a local actor who rewrites both content and hashes.

## 한국어 상태

한 번의 링크 입력 뒤 제한된 도착 확인과 명시 저장한 읽기들의 누적 문서가 구현되었습니다. 92개 원본 명령의 대응/미구현은 [전체 API 목록](legacy-api-inventory.md)에 남겼습니다. 네이티브 입력·검색 제출, 자동 페이지 읽기, fingerprint 재결합·형식 이전과 렌더 연구까지 완료한 것은 아닙니다. 설치된 확장과 실제 사이트의 유용성·UI 접근성은 별도 검증이 필요합니다.
