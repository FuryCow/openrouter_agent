# OpenRouter Agent

[![Latest release](https://img.shields.io/github/v/release/FuryCow/openrouter_agent?label=latest&sort=semver&style=flat-square)](https://github.com/FuryCow/openrouter_agent/releases/latest)
[![Build](https://img.shields.io/github/actions/workflow/status/FuryCow/openrouter_agent/release.yml?branch=main&style=flat-square&label=release%20build)](https://github.com/FuryCow/openrouter_agent/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/github/license/FuryCow/openrouter_agent?style=flat-square)](https://github.com/FuryCow/openrouter_agent/blob/main/README.md#license)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)

**Desktop AI coding environment** — chat, file explorer, Monaco editor, integrated terminal, and autonomous agent tools over the [OpenRouter](https://openrouter.ai/) API.

Built with Electron, React, and TypeScript. Runs locally on your machine; source code and workspace stay on disk unless you send them to a model.

| | |
|---|---|
| **Latest release** | [v0.9.4](https://github.com/FuryCow/openrouter_agent/releases/tag/v0.9.4) |
| **License** | MIT |
| **Runtime** | Node.js 24+ |
| **Platforms** | Windows (NSIS), macOS (DMG), Linux (AppImage) |

---

## Table of contents

- [Overview](#overview)
- [Capabilities](#capabilities)
- [Architecture](#architecture)
- [Operating modes](#operating-modes)
- [Security & governance](#security--governance)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Agent tools](#agent-tools)
- [MCP integration](#mcp-integration)
- [Development](#development)
- [Project structure](#project-structure)
- [Changelog](#changelog)
- [License](#license)

---

## Overview

OpenRouter Agent is a self-contained IDE-style application for AI-assisted software development. It combines:

- **Multi-mode chat** — autonomous agent, read-only Q&A, and structured planning.
- **Workspace tooling** — file I/O, hybrid codebase search, terminal execution, and web search.
- **Review workflow** — inline diffs, run checkpoints, selective revert, and task checklists.
- **Local indexing** — ripgrep, SQLite FTS, symbol extraction, and offline semantic embeddings.

The UI is optimized for long agent sessions: streaming responses, tool-call timelines, context chips, run status, and attachment support for images and text files.

---

## Capabilities

### Workspace & editor

| Area | Description |
|------|-------------|
| **File explorer** | Lazy-loaded tree; open, rename, delete; image preview tabs |
| **Monaco editor** | Syntax highlighting, multi-tab editing, inline run diffs |
| **Terminal** | Multi-tab PTY via xterm.js; auto-named tabs; ANSI-safe titles |
| **Command palette** | Quick open files, recent files, and editor commands |

### Agent & chat

| Area | Description |
|------|-------------|
| **Streaming chat** | Reasoning blocks, tool timelines, retry/remember actions |
| **Context control** | Pin or exclude open files; compact context chips |
| **Attachments** | Images and text/code files sent as structured `<attached_file>` blocks |
| **Run review** | Changes strip, checkpoint summary, per-file revert |
| **Persistence** | Conversations saved locally; debounced flush on close |

### Code intelligence

| Area | Description |
|------|-------------|
| **`grep_workspace`** | Regex search via bundled ripgrep |
| **`codebase_search`** | Hybrid FTS + symbols + local semantic embeddings (offline) |
| **Project memory** | Workspace-scoped notes the agent can read and update |
| **MCP servers** | Extend tools via Model Context Protocol (stdio / HTTP / SSE) |

### Models

- Dynamic model list from OpenRouter (tool-capable models for agent mode).
- Filter by vision support; sort by price, capability, or name.
- Per-model pricing shown as input/output per 1M tokens.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Renderer (React + Zustand)                                 │
│  Chat · Explorer · Editor · Terminal · Settings             │
└──────────────────────────┬──────────────────────────────────┘
                           │ IPC (contextBridge)
┌──────────────────────────▼──────────────────────────────────┐
│  Main process (Electron)                                      │
│  Agent loop · Tool execution · Indexing · MCP · Persistence   │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   OpenRouter API    Local workspace    SQLite + HNSW
   (LLM + tools)     (fs, pty, rg)      (codebase index)
```

**Stack:** Electron 33 · electron-vite · React 19 · TypeScript · Tailwind CSS 4 · Radix UI · Monaco · xterm.js · Zustand · i18next

---

## Operating modes

| Mode | Tools | Purpose |
|------|-------|---------|
| **Agent** | Full read/write, terminal, search, MCP | Implement changes autonomously with approval gates |
| **ASK** | None | Answer questions using open-file context only |
| **Planner** | Read-only exploration | Produce structured plans; hand off to Agent |

Planner output can be approved and passed to Agent mode as an execution plan with an optional task checklist.

---

## Security & governance

OpenRouter Agent is designed for **local, user-controlled** workflows:

- **API keys** stored locally via `electron-store`; never committed to the repository.
- **Approval gates** for file writes and terminal commands (configurable auto-approve per category).
- **Workspace safety** blocks destructive shell patterns and redirects code search away from raw terminal grep.
- **Project memory hygiene** — conventions and decisions only; no secrets or credentials in memory.
- **Context isolation** — renderer has no direct Node/fs access; tools run in the main process.

> **Note:** LLM requests send selected context (messages, attachments, open files, tool results) to your chosen OpenRouter model. Review provider terms and data policies before use in regulated environments.

---

## Quick start

### Prerequisites

- [Node.js](https://nodejs.org/) **24+**
- [OpenRouter API key](https://openrouter.ai/keys)

### Install

```bash
git clone https://github.com/FuryCow/openrouter_agent.git
cd openrouter_agent
npm install
```

Native modules (`better-sqlite3`, `hnswlib-node`) are rebuilt for Electron on `postinstall` via `node scripts/rebuild-native.mjs`. If indexing fails after install:

```bash
npm run postinstall
```

The first semantic index run downloads an embedding model (~25 MB) to the app user-data directory.

### Run

```bash
npm run dev          # development
npm run build        # production build
npm run package      # installers → release/
npm test             # unit tests (Vitest)
```

On first launch, open **Settings** (`Ctrl+L`) and enter your OpenRouter API key. Select a model from the title bar.

---

## Configuration

| Setting | Description |
|---------|-------------|
| **API key** | OpenRouter bearer token |
| **Model** | Any tool-capable model from OpenRouter |
| **Temperature** | Sampling temperature for completions |
| **Custom system prompt** | Prepended in Agent mode |
| **Auto-approve writes** | Skip confirmation for file edits |
| **Auto-approve terminal** | Skip confirmation for shell commands |
| **MCP servers** | JSON config for external tool servers |
| **Locale** | UI language (English bundled; i18n-ready) |

Terminal note: `node-pty` uses prebuilt binaries. If the terminal fails after an Electron upgrade on Windows, install [Spectre-mitigated MSVC libs](https://aka.ms/Ofhn4c) and run:

```bash
npx electron-rebuild -f -o node-pty
```

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save current file |
| `Ctrl+P` | Command palette / quick open |
| `Ctrl+L` | Settings |
| `Ctrl+\`` | Toggle terminal panel |
| `Ctrl+Shift+\`` | New terminal tab |
| `Ctrl+/` | Keyboard shortcuts reference |
| `Enter` | Send message |
| `Shift+Enter` | New line in composer |

---

## Agent tools

| Tool | Description |
|------|-------------|
| `read_files` | Read 1–10 files in one call (primary read tool) |
| `write_file` | Create or overwrite files |
| `search_replace` | Targeted in-file edits |
| `list_directory` | List directory entries |
| `grep_workspace` | Regex search across workspace (ripgrep) |
| `codebase_search` | Hybrid FTS + symbols + semantic search |
| `run_terminal` | Execute shell commands (build, test, servers) |
| `web_search` | Web search via DuckDuckGo |
| `get_open_files` | List open editor tabs and selection context |
| `read_project_memory` | Read workspace memory entries |
| `update_project_memory` | Append or update project memory |
| `create_task_checklist` | Create a run checklist (Agent mode) |
| `update_task_checklist` | Update checklist step status |

Deprecated aliases (`read_file`, `search_files`) are mapped automatically.

**Exploration convention:** search first (`codebase_search` / `grep_workspace`), scope paths, then batch-read with `read_files`. Do not grep source via `run_terminal`.

---

## MCP integration

Configure MCP servers in **Settings → MCP**. Supported transports:

- **stdio** — local process (`command` + `args`)
- **HTTP / SSE** — remote servers

MCP tools appear as `mcp__<serverId>__<toolName>` in the agent tool list. Servers can be tested and saved from the settings panel.

---

## Development

```bash
npm run dev            # hot-reload dev server
npm run build          # compile main + renderer
npm run test           # Vitest (189+ tests)
npm run i18n:check     # validate locale key usage
```

### Project structure

```
openrouter_agent/
├── electron/           # Main process: agent, tools, indexing, MCP
│   ├── services/       # Agent loop, filesystem, terminal, OpenRouter
│   └── lib/            # Shared utilities (diff, tokens, errors)
├── src/                # Renderer: React UI, stores, hooks
│   ├── components/     # Chat, editor, explorer, terminal, layout
│   ├── stores/         # Zustand state
│   └── i18n/           # Locale bundles
├── scripts/            # Build and i18n scripts
└── release/            # Packaged installers (generated)
```

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release notes.

---

## License

MIT — see repository for details.
