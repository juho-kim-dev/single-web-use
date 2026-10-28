# PAW SWU development

Start with README, docs/requirements.md, docs/architecture.md and the assigned issue. Keep implementation, local tests, installation, real-site trials and release evidence separate. Common PAW guidance is maintained in CocaPls/paw main; verify the relevant adopted revision rather than treating another local checkout as current.

Use the smallest complete change; preserve strict boundaries, error handling, immutable observations and unknown delivery. One runtime owns state for CLI, MCP and Browser Adapter. Packs are declarative definitions; no arbitrary page evaluation, secret export or private capture publication.

Run `npm run check`, `npm test`, `npm run build` for source changes. New nontrivial logic needs a meaningful regression. Synthetic Chrome tests do not substitute for foreground extension or real-site verification. Real-site trials start from bookmarked home or Google home search and remain read/search/navigation only unless separately authorized. Preserve existing tabs/settings/work.

Keep `.local`, state directories, credentials, sessions, original conversations and private site captures out of commits. Review exact staging. No force reset/clean or unrelated repo changes.

GitHub Actions remain paused until explicit user resumption: no workflows, runs or dispatch. Use `[skip ci]` in every delivery/integration commit. Publication and remote writes belong to the assigned supervisor; local development does not authorize a release, repository changes or access expansion.
