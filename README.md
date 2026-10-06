<p align="center">
  <img src="build/icon.png" width="128" alt="OpenRouter Agent">
</p>

<h1 align="center">OpenRouter Agent</h1>

<p align="center">
  A local desktop workspace for coding with any model on OpenRouter.<br>
  Chat, files, editor, terminal, and an agent that edits the project in front of you.
</p>

<p align="center">
  <a href="https://github.com/FuryCow/openrouter_agent/releases/latest"><img src="https://img.shields.io/github/v/release/FuryCow/openrouter_agent?include_prereleases&sort=semver&style=flat-square" alt="Current release"></a>
  <a href="https://github.com/FuryCow/openrouter_agent/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/FuryCow/openrouter_agent/ci.yml?branch=main&style=flat-square&label=build" alt="Build"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/FuryCow/openrouter_agent?style=flat-square" alt="MIT license"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D24-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 24+"></a>
</p>

<p align="center">
  <a href="https://github.com/FuryCow/openrouter_agent/releases/latest"><strong>Download</strong></a>
  ·
  <a href="#install-from-source">Install from source</a>
  ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

---

The app runs on your machine. The workspace stays on disk. A request goes to OpenRouter only when you send a message, and it includes the context you attached: the conversation, open files, and tool results.

Current release: [v1.0.0-alpha.8](https://github.com/FuryCow/openrouter_agent/releases/tag/v1.0.0-alpha.8) · Windows (NSIS), macOS (DMG), Linux (AppImage) · MIT

## What you get

| | |
|---|---|
| **Workspace** | File tree, Monaco editor, image preview, multi-tab terminal |
| **Agent** | Streams an answer, calls tools, shows a diff, and can roll a run back |
| **Ask** | Reads the project and answers. Does not write files or run the shell |
| **Planner** | Drafts a plan and may edit only the markdown under `.openrouter/plans/` |
| **Search** | Ripgrep, SQLite full-text, symbols, and an offline embedding index |
| **MCP** | Extra tools from stdio, HTTP, or SSE servers, tested per server |

Writes and shell commands stop for approval unless you turn auto-approve on for that category. Each run keeps a checkpoint, so one file or the whole run can be restored.

## Modes

| Mode | Can change the project | Used for |
|------|------------------------|----------|
| **Agent** | Yes, after approval | Implementing the task |
| **Ask** | No | Questions about the code that is already there |
| **Planner** | Only saved plan files | A plan you can hand to Agent |

A finished plan can be sent to Agent from the chat. Ask and Planner keep going until the answer is done or you stop the run.

## Download

Installers are attached to each [GitHub release](https://github.com/FuryCow/openrouter_agent/releases/latest).

Since v1.0.0-alpha.8 the app checks GitHub for new releases and shows a card in the bottom-left corner, with a one-click installer download. If you are on v1.0.0-alpha.7 or older, update manually this one time — from alpha.8 on, the app will tell you about new releases itself. Notifications can be turned off in Settings → General.

On first launch, open **Settings** (`Ctrl+L`) and paste an [OpenRouter API key](https://openrouter.ai/keys). Pick a model from the title bar. The app version is shown in the status bar and at the bottom of Settings.

## Install from source

[Node.js 24+](https://nodejs.org/) or newer.

```bash
git clone https://github.com/FuryCow/openrouter_agent.git
cd openrouter_agent
npm install
npm run dev
```

`npm install` rebuilds `better-sqlite3` and `hnswlib-node` for Electron. If the index fails to open after an Electron upgrade, run `npm run postinstall` again.

The first semantic index downloads an embedding model (about 25 MB) into the app data directory.

| Command | What it does |
|---------|----------------|
| `npm run dev` | Development window with reload |
| `npm run build` | Compile main and renderer |
| `npm run package` | Installers in `release/` |
| `npm test` | Unit tests |
| `npm run i18n:check` | Locale keys |

If the terminal fails after an Electron upgrade on Windows, install the [Spectre-mitigated MSVC libraries](https://aka.ms/Ofhn4c) and run `npx electron-rebuild -f -o node-pty`.

## Settings

| Setting | What it controls |
|---------|------------------|
| API key | OpenRouter token, stored locally with `electron-store` |
| Model | Tool-capable models for Agent; vision filter and price sort in the picker |
| Temperature | Sampling temperature |
| Custom system prompt | Extra instructions in Agent mode |
| Auto-approve writes | Skip the card for file edits |
| Auto-approve terminal | Skip the card for shell commands |
| MCP servers | External tools. **Test** checks one server. **Save** does not reconnect them |
| Locale | English |
| Update notifications | Check GitHub for new releases and show a card with an Install button |

## Shortcuts

| Keys | Action |
|------|--------|
| `Enter` | Send |
| `Shift+Enter` | New line |
| `Ctrl+S` | Save the file |
| `Ctrl+P` | Quick open |
| `Ctrl+L` | Settings |
| `` Ctrl+` `` | Terminal |
| `` Ctrl+Shift+` `` | New terminal tab |
| `Ctrl+/` | Shortcut list |

## Tools the agent can call

| Tool | What it does |
|------|----------------|
| `read_file` / `read_files` | Read one file, or up to 10 in one call |
| `write_file` | Create or overwrite a file |
| `search_replace` | Replace one match, or every match |
| `list_directory` | List a folder |
| `grep_workspace` | Regex search with ripgrep |
| `search_files` | Text search under a root |
| `codebase_search` | Full-text, symbols, and semantic hits |
| `run_terminal` | Run a command in the workspace |
| `web_search` | Search the web |
| `get_open_files` | Tabs currently open in the editor |
| `read_project_memory` / `update_project_memory` | Notes kept for this project |
| `create_task_checklist` / `update_task_checklist` | Steps for the current run |

Search the tree before reading whole files. Shell search through `run_terminal` is blocked; use `grep_workspace` or `codebase_search`.

MCP tools show up as `mcp__<server>__<tool>`.

## Security

The API key stays on disk and is not part of the repository. The window cannot touch the filesystem itself; tools run in the main process. The app refuses to use its own install folder as the workspace. Project memory is for conventions and decisions, not secrets.

The model still receives whatever you put in the conversation. Read the provider terms before using this on a private codebase.

## Project layout

```
electron/     main process: agent loop, tools, index, MCP
src/          React UI, stores, i18n
scripts/      native rebuild and locale check
build/        app icon
release/      installers produced by npm run package
```

## License

MIT. See [LICENSE](LICENSE).
