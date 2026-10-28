# Ordered implementation and review gates

1. Inspect source and contracts; map requirements and provenance before importing code. Do not move Nomiya host/store/data into this project.
2. Define strict pack, observation, action and receipt contracts. Add bounded disk storage with one runtime owner and durable operation journal.
3. Connect actual extension worker through authenticated loopback. Build a foreground-tab collector and synchronous guarded synthetic primitives. Test stale identity, cancellation, duplicates, disconnect and origin rejection.
4. Add CLI and stdio MCP against the same server. Provide exact setup steps and useful discovery rather than placeholder transports.
5. Add draft/propose/edit/test/activate, role extraction, procedure execution, drift, overlay and update preview/export/import. Bind tests to new observations and revision hashes.
6. Build and test all connected paths. Run Ponytail review and Graphify AST with source hashes in ignored output. Fix findings before local commit.
7. External Chrome: load unpacked artifact, pair privately, bind existing foreground page; read then navigate from bookmarked/Google home. Compare visible titles/links and guard refusals; no write transactions. Supervisor assists if UI permissions are missing.
8. Supervisor independent review and repairs. Supervisor alone handles remote commits/PR/publication; retain `[skip ci]`. Release/platform/client support requires separate evidence.

Remaining historical files supplied later are analyzed as a follow-up; unavailable sources are never treated as inspected.
