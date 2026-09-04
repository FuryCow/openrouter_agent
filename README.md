# OpenRouter Agent

A beautiful desktop AI coding agent built with Electron, React, and OpenRouter. Features an integrated chat, file explorer, Monaco code editor, terminal, and agent tools.

## Features

- **Agent Chat** — Streaming conversations with tool calling via OpenRouter API
- **File Explorer** — Browse and open project files with lazy-loaded tree
- **Code Editor** — Monaco editor with syntax highlighting and tabs
- **Terminal** — Integrated shell via xterm.js + node-pty
- **Agent Tools** — read/write files, hybrid codebase search, run commands, web search
- **Codebase Index** — Local ripgrep + SQLite FTS + symbols + semantic embeddings (offline)
- **Beautiful UI** — Dark theme with indigo/violet accents, glass panels, smooth animations

## Prerequisites

- Node.js 24+
- OpenRouter API key ([get one here](https://openrouter.ai/keys))

## Setup

```bash
npm install
```

Native modules (`better-sqlite3`, `hnswlib-node`) are rebuilt for Electron via `postinstall` (`node scripts/rebuild-native.mjs`). This removes Windows prebuilds and compiles against the bundled Electron headers. `node-pty` is left on its prebuild; if the terminal fails after an Electron upgrade, install [Spectre-mitigated MSVC libs](https://aka.ms/Ofhn4c) and run `npx electron-rebuild -f -o node-pty`.

If indexing crashes on startup, rerun:

```bash
npm run postinstall
```

First semantic index run downloads the embedding model (~25MB) to your app user data folder.

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Package

```bash
npm run package
```

Creates installers in the `release/` directory.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save current file |
| `Ctrl+\`` | Toggle terminal |
| `Ctrl+P` | Quick open file |
| `Ctrl+/` | Keyboard shortcuts |
| `Ctrl+L` | Open settings |

## Configuration

On first launch, open **Settings** and enter your OpenRouter API key. Choose a model from the title bar picker.

The model list is loaded dynamically from OpenRouter — **all models with tool calling** (agent-capable), including budget options like `z-ai/glm`, `deepseek`, `qwen`, etc.

- Filter toggle **Vision only** for image-capable models
- Sort by **Cheapest**, **Premium**, **Agentic**, or **A–Z**
- Prices shown as **input / output per 1M tokens**

## Agent Tools

The agent can autonomously use these tools:

| Tool | Description |
|------|-------------|
| `read_file` | Read one file (deprecated — use `read_files`) |
| `read_files` | Read 1–10 files in one call (primary read tool) |
| `write_file` | Create or update files |
| `list_directory` | List directory contents |
| `search_files` | Regex text search (deprecated, use `grep_workspace` or `codebase_search`) |
| `grep_workspace` | Regex search across workspace files (ripgrep) |
| `codebase_search` | Hybrid search: FTS + symbols + local semantic embeddings |
| `run_terminal` | Execute shell commands (build/test/server — not for grepping code) |
| `web_search` | Search the web via DuckDuckGo |
| `get_open_files` | Get context from open editor tabs |

## Tech Stack

- Electron 33 + electron-vite
- React 19 + TypeScript
- Tailwind CSS 4 + Radix UI
- Monaco Editor + xterm.js
- OpenRouter API (OpenAI-compatible)
- Zustand + Framer Motion

## License

MIT
