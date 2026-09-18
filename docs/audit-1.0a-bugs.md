# v1.0a Bug Tracker

## Open

_None._

## Fixed during audit

| ID | Sev | Module | Description | Fix |
|----|-----|--------|-------------|-----|
| AUD-001 | P1 | src/App.tsx | Missing `isImagePath` import broke Ctrl+S save guard | Restored import |
| AUD-002 | P1 | src/App.tsx | Editor/terminal/explorer unprotected from render crashes | ErrorBoundary wrappers |
| AUD-003 | P2 | electron/main.ts | Unhandled promise rejections could crash silently | `unhandledRejection` handler |

## Deferred (P2)

| ID | Sev | Module | Description |
|----|-----|--------|-------------|
| AUD-D01 | P2 | CI | Indexing SQLite tests skipped on Linux CI |
| AUD-D02 | P2 | websearch.ts | No unit tests for provider fallback |
| AUD-D03 | P2 | Manual QA | macOS/Linux smoke not run in this session |
