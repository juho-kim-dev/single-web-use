# Contributing

Read [requirements](docs/requirements.md), [architecture](docs/architecture.md) and [validation](docs/validation.md). Keep adapters separate from core contracts and the single runtime store. Packs are JSON, never a page-eval channel.

Use Node 22+ and `npm ci`. Run `npm run check`, `npm test`, `npm run build`. New trust-boundary, persistence, input or lifecycle logic needs a meaningful regression. Synthetic tests remain separate from foreground-browser and real-site evidence.

Describe the concrete trigger, resulting behavior, actual checks and remaining risks. Include no credentials, browsing logs, screenshots from personal sessions, private captures, original conversations or private definitions. Preserve immutable evidence, unknown delivery and no blind retries.

Actions are paused for this work. Do not add/enable workflows or dispatch runs. Local implementation commits use `[skip ci]`; remote publication belongs to the supervisor. Passed local tests do not establish installation/release approval.
