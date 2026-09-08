# Changelog

All notable changes to this project are documented in this file.

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
