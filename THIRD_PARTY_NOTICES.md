# Provenance and dependencies

The PAW implementation in `src/` and `extension/` was independently written here. No Nomiya/vault source or compiled bundle is included. Inspected commits and conceptual inheritance are recorded in [inheritance](docs/inheritance.md).

- Runtime dependency: **Zod 4.6.7**, MIT, copyright Colin McDonnell and contributors. Its complete license is distributed in the installed package. Exact version and integrity are pinned in `package-lock.json`.
- Historical **CocaPls/single-web-use** is MIT. Its Bash/Obsidian mechanisms informed analysis; no Bash source is copied here.
- **SWU Nomiya** and the Izakaya compiled product were authorized read-only analysis inputs. No private vault records, captures, personal definitions or original conversations are included. Their existence does not establish compatibility or grant third-party asset licenses.
- Chrome APIs, Node APIs and MCP references are linked from the architecture document. No third-party UI assets, fonts, screenshots or benchmarks are bundled.

Future reused code must retain applicable notices and identify its source commit/path and adaptation. Do not copy host bundles or whole private vaults into this public tree.
