# Changelog

All notable changes to this project are documented in this file.

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
