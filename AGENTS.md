# Repository Guidelines

## Project Structure & Module Organization

- `src/` contains the Node.js service. `server.mjs` serves the workbench and HTTP API, `agent.mjs` runs research and review workflows, `deepseek.mjs` and `chat-demo.mjs` handle DeepSeek integration, and `notebook.mjs` and `files.mjs` handle notes and persistence.
- `public/` contains the workbench HTML, CSS, browser modules, and static assets. `public/chat-demo/` ships the built DeepSeek Chat Demo. Make integration changes in `scripts/chat-demo/` or `scripts/patch-chat-demo.mjs`, then regenerate the bundle.
- `test/` contains the research and workbench tests (`mvp.test.mjs`) and the chat integration tests (`chat-demo.test.mjs`).

## Build, Test, and Development Commands

Use Node.js 22.12 or newer. The main app has no runtime dependencies or build step.

- `npm start` runs the workbench at `http://127.0.0.1:4317` by default. Restart after editing server code, static assets, or `.env`.
- `start.cmd` launches the app and opens the browser on Windows. Use `start.cmd --no-open` to skip opening it.
- `npm test` runs the full test suite. `node --test test/chat-demo.test.mjs` runs just the chat tests.
- `./scripts/build-chat-demo.ps1` rebuilds the bundled Chat Demo from a pinned upstream revision. Run it in PowerShell with `pnpm` available.

## Coding Style & Naming Conventions

Use two spaces, single quotes, semicolons, and `camelCase` for functions and variables. Keep server modules in ES module `.mjs` files and workbench browser modules in `.js` files. Prefer Node built-ins. No formatter or lint script is configured.

## Testing Guidelines

Use `node:test` and `node:assert/strict` in `test/*.test.mjs`. Use descriptive test names, temporary state and vault directories, and local HTTP mocks for DeepSeek calls. Add regression cases for changed behavior; no numerical coverage threshold is configured. For live API verification, run `node scripts/live-smoke.mjs` with a valid key. It consumes API quota.

## Commits & Pull Requests

Use short, imperative commit subjects, such as `Fix review retry handling`. In pull requests, describe the behavior change, list the checks run, link related issues, and include screenshots for visible UI changes.

## Local Configuration

Copy `.env.example` to `.env` and set `DEEPSEEK_API_KEY` for live calls. Keep `.env`, `.wu-agent/` runtime data, and personal `vault/` notes out of commits.
