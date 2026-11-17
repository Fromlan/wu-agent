# Repository Guidelines

This repository is a DeepSeek Harness plugin bundle, not a standalone app. Its root is the package: `package.json` declares the bundle patch and the browser half.

## Project Structure & Module Organization

- `index.js` — Host half: vault configuration, the browser JSON API under `/plugin/dsh-knowledge-workbench`, the `schedule` integration, and tool registration.
- `lib/store.js` — vault operations: candidate cards, review transitions, preference/question mirrors, briefs, search.
- `lib/tools.js` — the six agent tools. Keep raw JSON Schema shapes; this bundle intentionally imports nothing from the DSH installation.
- `lib/note.js` — frontmatter parsing/rendering, card rendering, dates, note ids.
- `lib/bases.js` — the Obsidian Bases `.base` document and the `确认` review constant. The file is seeded only when missing; never overwrite a user's edited base.
- `lib/research.js` — daily and on-demand research prompts plus time validation.
- `client.js` — browser half, registered through `window.__ModuleLoader__.load`. It must not import Harness Client packages; render controls with React elements and style only with `--dsw-alias-*` tokens.
- `locale/` — `meta.title`, `meta.description`, and `meta.detail` for Plugin Manager.
- `docs/` — the single-image detail documents.
- `test/` — `node:test` suites for the store, browser API, and tool definitions.

## Build, Test, and Development Commands

Use Node.js 22.12 or newer. There is no build step and no runtime dependency.

- `node --test` (or `npm test`) runs the suite.
- `node --check index.js` — syntax check the Host half; repeat for `client.js` and every `lib/*.js`.
- Install or update the plugin through DSH **Plugins → Add plugin → local directory** (repo root). In a management session, `plugin_manager install_bundle` with the absolute repo path performs the same install.
- While developing, DSH HMR reloads changed bundle files after the next profile recomposition (for example, toggling the plugin row); the browser half reloads through client HMR.

## Coding Style & Naming Conventions

Two spaces, single quotes, semicolons, `camelCase` for functions and variables. Keep runtime modules as ES modules. Prefer Node built-ins; do not add dependencies without a clear reason. No formatter or lint script is configured.

## Testing Guidelines

Use `node:test` and `node:assert/strict` under `test/*.test.mjs`. Use temporary vault directories (`fs.mkdtemp`), never the user's real vault. Cover the Bases seed, the `review: 确认` publish path, and card database properties when changing them. Add regression cases for behavior changes; no coverage threshold is configured.

## Commits & Pull Requests

Short imperative subjects, such as `Fix card delete confirmation`. In a pull request, describe the behavior change, list the checks run, and call out anything that was not verified in a live browser.

## Local Configuration

The vault path is row configuration (`config.vault`), not an environment file. The default is `~/Documents/DSH知识库`. Do not commit generated vault contents, `node_modules/`, or logs.
