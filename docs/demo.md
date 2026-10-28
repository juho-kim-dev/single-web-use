# Reproducible local demo

This is a synthetic fixture, not proof of real-site support. No fabricated screenshots or performance claims accompany it.

1. Build/load/pair the adapter and start the runtime as described in README. Start the fixture with `node scripts/demo.js`.
2. Open `http://127.0.0.1:47832/` in an ordinary Chrome tab, focus it, invoke the extension and Connect current tab. Observe → Read now should show the heading, query control and local link. Accessibility `label` and bounded `text` are separate.
3. In Site packs → New draft, paste `examples/search-pack.json`; Save draft → Test current draft → Activate tested revision. Record revision and test observation ID privately. The locator test is not a procedure-outcome test.
4. Choose procedure `fill-query`, arguments `{"query":"SWU evidence"}` and a new operation ID. Run once. The query field and local echo should change. The example's final enabled condition only proves that condition, not that every site accepted the query.
5. Read receipt with the same ID. Reusing `examples/run-query.json` returns its previous receipt after its first run. Change parameters under the same ID and expect `operation-id-conflict`, with no second input. Only use a new ID for a separately intended action after inspecting current evidence.
6. Read a fresh observation, change the field manually, then request an act based on the old observation. Expect not-sent/stale refusal. Close/reconnect or switch tabs and confirm old evidence cannot drive another tab.
7. Check drift, edit the selector/version and save. Old tests cannot activate the changed revision. Preview an incoming update and confirm the old active definition remains until a fresh test and explicit activation.
8. Export/import definitions only; no observation, token or capture should appear. Preserve installed bases separately from personal overlays. Stop the fixture/runtime and close only your own trial tabs.

For real-site validation, start from a bookmarked service home or Google home search. Use read/search/navigation only, preserve existing tabs/settings, and record browser/version, viewport, concrete returned visible titles/links, guard failures and restoration. Do not enter direct internal URLs as a shortcut or perform posting/purchase/delete trials. The supervisor owns that verification; none has been run for this checkpoint.
