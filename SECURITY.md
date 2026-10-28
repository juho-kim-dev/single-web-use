# Security boundaries

The runtime binds only 127.0.0.1:47831. Browser clients need the pinned extension Origin/identity and a random 256-bit bearer token; local CLI/MCP need the same token. Website/null Origins are refused. No cookies, wildcard CORS, externally connectable page channel or arbitrary eval. Local code with the secret can impersonate a client: this is a local-user tool, not OS isolation.

Keep `~/.paw-swu` private. Mode 0600/0700 is requested where supported; Windows ACLs inherit from your user directory and are not hardened by this application. Extension local storage contains the token. Initialization/status never print it. Do not forward/tunnel this port or publish runtime state.

To rotate a token or re-pair a changed extension ID: stop runtime, preserve `state.json` and operation history, move `connector.json` to a private offline backup, run `init NEW_EXTENSION_ID`, update extension token, restart and rebind. Do not delete the ledger to retry uncertain input. Remove a crashed `runtime.lock` only after verifying its recorded PID is no longer this runtime.

Site text, metadata and pack strings cannot authorize actions. Primitives reject sensitive controls, arbitrary buttons/forms and known destructive link patterns. This does not prove ordinary site links are side-effect-free: callers must restrict use to authorized safe tasks. Synthetic input may be ignored or handled differently.

Cancellation cannot undo leased/delivered input. After lease, possible delivery remains unknown; input is fenced until explicit rebind. Read receipts and inspect current page state. Never blindly retry with a new operation ID.

One runtime owns the directory, enforced by the CLI lock. Digest rechecks detect many external edits, including changes during preparation, but check+rename is not atomic compare-and-swap. Use API/editor, not external state editing. Preserve an unsaved editor draft on conflict, then reload before saving. No ledger/history pruning occurs automatically.

Report security concerns privately through an available maintainer profile contact. Do not post tokens, private browsing evidence or personal exploit data in public issues. This preview has no established dedicated private reporting channel or response-time guarantee.
