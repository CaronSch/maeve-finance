# Update Docs

## Instructions

Check whether the changes affect any external-facing documentation. All documentation lives in the root `./docs/` folder (synced to GitBook).

First, identify which services were touched by the current changes. Then determine if any user-facing behavior changed.

**Finding the right docs file:** Use `./docs/SUMMARY.md` as the map. It lists every page with its file path. Match the changed service/chain to the relevant section (e.g. Ethereum searcher changes → `./docs/ethereum/searchers/`, Base changes → `./docs/base/`).

**When updating docs:**
- Keep the tone external-facing and user-friendly (these are read by searchers/integrators, not internal devs)
- We have both originator users (wallets, RPC providers, oracles, solvers) and searcher users — each docs page targets one audience, never both
- Preserve existing structure and section headings unless a section is no longer accurate
- Only update what has actually changed — do not rewrite sections that are still correct

**When adding new docs:**
- Create the file under the appropriate chain/topic directory in `./docs/`
- Add a corresponding entry in `./docs/SUMMARY.md` in the correct position
- Follow the existing page structure and frontmatter style of nearby pages

If nothing user-facing changed, skip this step.
