# Changelog

All notable changes to this project are documented in this file.

## [1.0.0-alpha.10] — 2026-10-08

### Fixed

- **Installer integrity check:** downloaded installers are now verified against the GitHub asset size and sha256/sha512 digest before launch, streamed into a temporary `.part` file and renamed only after verification; truncated or corrupted downloads are retried (3 attempts, stall timeout 30 s) instead of being handed to NSIS, which answered with "Installer integrity check has failed".

---

## [1.0.0-alpha.9] — 2026-10-07

### Fixed

- **Prompt-injection false positives:** the skill distillation prompt used bracketed role markers ([user] / [assistant]) that OpenRouter's injection detector flags as bracket-role spoofing. Replaced with plain user:/assistant: prefixes.
- **README:** corrected the MCP tool name format (mcp__<serverId>__<toolName>) and refreshed the stale "Current release" line; documented update notifications and the one-time manual update for alpha.7 users.

---

## [1.0.0-alpha.8] — 2026-10-06

### Update notifications

- **Release notifications:** when a newer GitHub release is published, a card appears in the bottom-left corner with the release name and the first note line. Checked via the GitHub API 15 seconds after startup and then every 4 hours; results are cached.
- **One-click install:** the Install button picks the platform installer (Windows → NSIS Setup.exe, macOS → .dmg with arm64/x64 selection, Linux → .AppImage), downloads it with a progress bar and launches it.
- **Skip this version:** dismisses the card and remembers the choice in settings, so the same release does not nag again.
- **Opt-out:** Update notifications toggle in Settings → General (enabled by default).

### Tools

- **EOL-aware search_replace:** multi-line old_string now matches CRLF files with LF line endings and vice versa; bytes outside the replaced span are preserved; the diff preview uses the same resolver.

---

## [1.0.0-alpha.7] — 2026-10-06

### Skills (behind the skillsEnabled flag, off by default)

- **Native skills system:** markdown skills with YAML frontmatter in global (~/.openrouter_agent/skills) and project (<workspace>/.openrouter/skills) directories; project skills override global ones with the same name.
- **Progressive disclosure:** the agent system prompt lists only skill names and descriptions (cap 20, description up to 200 chars); the full SKILL.md is loaded on demand via the new load_skill tool (agent mode only).
- **Skills panel in Settings → Agent:** list, view, create, edit, delete project skills; global skills are read-only. Toggle to enable the feature.
- **Distillation:** "Distill into skill" button on successful agent runs reflects on the session trajectory via LLM and drafts a SKILL.md for preview and one-click save to project skills.
- **Fixes:** load_skill is registered in tool validation (was rejected as unknown_tool before execution); load_skill accepts a bare skill name or root-relative path, not only an absolute path; the distill button stays visible while distilling (disabled with a spinner and an info toast).

---

## [1.0.0-alpha.5] — 2026-09-28

### Index

- The installed app can start ripgrep. The binary is unpacked next to `app.asar` instead of being launched from inside the archive.

### Terminal

- Switching folders restarts open terminal tabs in the new workspace. Closing the tab is no longer required.

---

## [1.0.0-alpha.4] — 2026-09-28

### Tests

- Agent runs now lock the tools sent to the model, history fields, token totals, file-read limits, replace-one versus replace-all, and the refusal to read the app's own folder.

---

## [1.0.0-alpha.3] — 2026-09-28

### Agent

- Ask and Planner no longer stop after a fixed number of tool steps. Every mode runs until the answer is done or you stop it.
- Russian plan headings (Цель, Шаги, Файлы, Проверка) are recognized when you implement a plan.
- The app version is shown in the status bar and at the bottom of Settings.

### Settings

- Save still writes every tab, and still does not reconnect MCP servers. Test stays on each server.

### Tests

- Product flows for approval, plan implementation, memory, version, folder switch, and a full agent run are covered.
- Mutation testing is available with `npm run test:mutation`.

---

## [1.0.0-alpha.2] — 2026-09-24

### Indexing

- Workspace file list goes through ripgrep, with the previous directory exclusions restored.
- New files are picked up without waiting out the file-list cache. A full build no longer drops edits that arrive mid-index, and cancelling a build clears the "building" status.
- Watcher debounce is back to 300ms.

### Ask and planner

- Ask mode can read the workspace (read-only tools, up to 12 steps) and no longer toasts "0 steps remaining" on every message.
- Planner can edit saved markdown plans under `.openrouter/plans/` only. Plans save through IPC with unique filenames.

### Settings

- Saving settings no longer reconnects every MCP server or rebuilds the agent. Per-server Test and Reconnect all do the connecting.

---

## [1.0.0-alpha.1] — 2026-09-18

First alpha after full stability audit. AI SDK migration is **not** included.

### Stability audit

- **Error boundaries:** Explorer, editor, and terminal panels wrapped in `ErrorBoundary` (chat already protected).
- **Workspace hydration:** Shared `resolveWorkspacePath` / `resolvePersistenceWorkspace` guards for chat and terminal startup races.
- **Main process:** `unhandledRejection` handler aborts in-flight agent runs instead of failing silently.
- **Ctrl+S fix:** Restored missing `isImagePath` import in `App.tsx`.

### Test coverage (+28 tests)

- `chatStore` streaming flush, reasoning cap, tool buffer
- OpenRouter SSE parser (`openrouter-sse`), API error formatting, retry guards
- Settings hydration order, persistence workspace resolution
- `agentRunStore` checklist guards, terminal service lifecycle
- HTTP network errors, model sort, debounced path collector

### CI

- `npm run build` added to PR/push CI workflow.

### Docs

- `docs/audit-1.0a-checklist.md` — module matrix and manual QA tracker
- `docs/audit-1.0a-bugs.md` — audit bug log (0 open P0/P1)

---

## [0.9.5] — 2026-09-18

### Stability & resilience

- **Error boundary:** Chat panel wrapped in `ErrorBoundary` so a render crash does not blank the whole app.
- **Renderer recovery:** Main process reloads the window on `render-process-gone` and aborts in-flight agent runs when IPC to the renderer is unsafe.
- **DevTools:** `Ctrl+Shift+I` / `Cmd+Shift+I` toggles DevTools from the main process.

### Chat & persistence

- **Workspace hydration:** Chat and terminal wait for settings hydration before loading workspace-scoped state; fixes empty chat on startup.
- **Legacy migration:** Workspace buckets now inherit chats from the `_legacy` bucket when empty.
- **Streaming:** Stream flush uses a 100ms timer instead of `requestAnimationFrame`; caps reasoning text at 250k chars during streaming.

### Tool UI

- **Compact summaries:** Repeated tool calls on the same file collapse into labels like `Write · foo.ts × 5` in message headers.

### Terminal & git context

- **Terminal fit:** `safeFit` guards xterm `fit()` against zero-size or disposed viewports.
- **Initial tab cwd:** First terminal tab picks up the workspace directory once settings load.
- **Empty git repos:** Workspace state handles repos with no commits yet (branch without `HEAD`).

### Tests

- Added coverage for terminal store cwd hydration, tool group summaries, and legacy bucket chat migration.

---

## [0.9.4] — 2026-09-09

### Agent UX & review

- **Context chips:** Pin/exclude open files for agent context; compact chips above the composer.
- **Run status:** Live status line (running, awaiting approval, checklist step) in the agent run panel.
- **Changes panel:** Cursor-like compact strip after a run; open changed files with inline diff in the editor; partial revert per file.
- **Diff review:** Fixed modified-line highlights, inline add/delete rendering, and minimap alignment in Monaco.
- **Tool groups:** Collapse repeated identical tool calls (e.g. `run_terminal ×8`) instead of spamming chips.

### Chat attachments

- Paperclip accepts text/code files, not only images; content is sent to the model in `<attached_file>` blocks.
- Fixed attachment priority so the agent answers from attached files instead of open editor tabs or chat history.

### Terminal

- Multiple terminal tabs; auto-name from first command; closing the last tab hides the panel.
- Strip ANSI escapes from tab titles and terminal output summaries.

### Shell & navigation

- Title bar layout: centered command palette, model picker + settings on the right.
- Command palette replaces quick-open (commands + recent files).
- Model picker polish: spacing from window edge, wider trigger, readable pricing.

### Tests

- 189 tests passing; added coverage for attachments, agent context, terminal tab titles, and ANSI stripping.

---

## [0.9.3] — 2026-09-08

### Visual polish

- **Design tokens:** Extended `@theme` with surface, popover, and chrome spacing tokens; added shared utilities (`.chrome-header`, `.input-field`, `.interactive-header`).
- **Unified shell:** Replaced ad-hoc panel hex colors with consistent `bg-background` / `bg-surface` across title bar, chat, explorer, editor, terminal, dialogs, and popovers.
- **Header rhythm:** Aligned chrome row heights (`h-9`) across panels for cleaner horizontal dividers.
- **Chat:** Softer user bubbles, elevated assistant cards, improved composer attachment remove button and message actions.
- **Empty states:** Shared `EmptyStateShell` for editor, chat onboarding, and explorer.
- **Misc:** Settings input focus rings, editor tab active accent, toast placement/animation, markdown colors via CSS tokens.

---

## [0.9.2] — 2026-09-08

### Bug fixes

- **Chat persistence:** Wait for settings hydration before loading/saving chats; flush debounced saves on app close and tab hide so conversations survive restarts.
- **Chat composer:** Fix unfocusable input caused by the mode selector’s invisible overlay; restore click-to-focus on the composer area.
- **Task checklist:** Normalize object-shaped `steps` (e.g. `{ text: "..." }`) instead of storing `[object Object]`; register `create_task_checklist` / `update_task_checklist` in tool validation.
- **Tool aliases:** Map model `grep` calls (`pattern` / `path`) to `grep_workspace` before execution.
- **Editor images:** Open PNG/JPEG/WebP and other images as a preview instead of binary garbage in Monaco; skip save for image tabs.

### Tests

- 168 tests passing; added coverage for checklist normalization, grep alias, chat persistence core, and tool-call display.

---

## [0.9.1] — 2026-09-08

### Internationalization (i18n)

- Added **i18next** + **react-i18next** with English locale bundles in 7 namespaces: `chat`, `common`, `errors`, `explorer`, `layout`, `settings`, `tools` (~430 UI keys).
- Migrated renderer UI strings from hardcoded / mixed RU text to `t()` keys across chat, explorer, layout, settings, debug, hooks, and stores.
- Added `locale` to app settings (default `en`); infrastructure ready for additional languages.
- Introduced structured **error codes** in the main process (`electron/lib/app-errors.ts`) with `errorCode` / `errorParams` on agent events; renderer resolves user-facing messages via `src/lib/errorMessages.ts`.
- Localized tool-call display labels and summaries (`src/lib/toolCallDisplayI18n.ts`).
- Added `npm run i18n:check` to validate namespace JSON and key usage.

**Note:** Agent system prompts and tool JSON schemas remain in English (intentional — model instructions).

### Chat composer & mode selector

- Unified **composer card**: mode bar + input in one bordered panel.
- Replaced inline mode list with a **compact dropdown** (icon + label; descriptions stay in the header line).
- Panel header now shows the **active mode name and themed icon** (Agent / ASK / Planner) instead of a static “Chat” title.
- Moved **token usage ring** into the composer header (compact variant) with larger typography in its popover.
- Polished dropdown UX: checkmark on the right, upward chevron anchored to the right edge, menu opens above the input.
- Added **smooth open/close animations** for the mode menu (controlled close delay so exit animation completes).

### Image attachments

- Click any attached or sent chat image to open a **full-size lightbox preview** (`ChatImagePreview`); close via overlay, ✕, or Escape.

### Tests

- 153 tests passing; added coverage for tool-call display i18n.

---

## [0.9.0] — 2026-09-08

- Structured plan handoff, `create_task_checklist` / `update_task_checklist`, memory hygiene, and related tests.
