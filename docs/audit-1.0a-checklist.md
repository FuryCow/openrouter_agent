# v1.0a Stability Audit Checklist

**Baseline (2026-09-18):** 225 passed, 2 skipped | i18n OK | build OK | CI build step added

| Module | Auto | Manual | Status | Bugs |
|--------|------|--------|--------|------|
| electron/main.ts | partial | S10 | reviewed | — |
| electron/preload.ts | contract | — | reviewed | — |
| electron/services/agent.ts | guards | S2,S3 | reviewed | — |
| electron/services/openrouter.ts | sse-parser | S2,S11 | reviewed | — |
| electron/services/agent-modes.ts | yes | S2 | pass | — |
| electron/services/filesystem.ts | partial | S4 | pass | — |
| electron/services/terminal.ts | partial | S5 | reviewed | — |
| electron/services/http.ts | yes | — | pass | — |
| electron/services/models.ts | yes | S7 | pass | — |
| electron/services/websearch.ts | — | S8 | pending | — |
| electron/services/workspace-safety.ts | yes | S2 | pass | — |
| electron/services/workspace-state.ts | yes | S6 | pass | — |
| electron/services/workspace-watcher.ts | yes | S6 | pass | — |
| electron/services/chat-persistence.ts | yes | S1,S10 | pass | — |
| electron/services/run-checkpoint.ts | yes | S4 | pass | — |
| electron/services/run-task-checklist.ts | yes | S2 | pass | — |
| electron/services/tool-analytics.ts | yes | — | pass | — |
| electron/services/indexing/* | partial | S9 | partial | — |
| electron/services/mcp/* | partial | S8 | pending | — |
| electron/services/project-memory/* | yes | S7 | pass | — |
| src/stores/chatStore.ts | yes | S11 | pass | — |
| src/stores/settingsStore.ts | yes | S1,S7 | pass | — |
| src/stores/agentRunStore.ts | yes | S2 | pass | — |
| src/stores/fileStore.ts | yes | S4 | pass | — |
| src/stores/terminalStore.ts | yes | S5 | pass | — |
| src/stores/indexStore.ts | — | S9 | reviewed | — |
| src/hooks/useChatPersistence.ts | yes | S1,S10 | pass | — |
| src/hooks/useAgent.ts | — | S2,S3 | reviewed | — |
| src/hooks/useWorkspace.ts | — | S6 | reviewed | — |
| src/components/chat/* | partial | S2,S11 | reviewed | — |
| src/components/editor/* | — | S4 | reviewed | — |
| src/components/terminal/* | partial | S5 | pass | — |
| src/components/explorer/* | — | S6 | reviewed | — |
| src/components/ui/ErrorBoundary.tsx | — | — | pass | — |

## Manual QA Matrix

| # | Scenario | Win | macOS | Linux |
|---|----------|-----|-------|-------|
| S1 | Cold start → workspace → chats load | pass* | pending | pending |
| S2 | Agent run: 3+ tools + approval | pending | pending | pending |
| S3 | Abort mid-run → UI recoverable | pending | pending | pending |
| S4 | Checkpoint restore (full + partial) | pending | pending | pending |
| S5 | Terminal: 3 tabs, resize, close | pass* | pending | pending |
| S6 | Workspace switch → chat/terminal/index | pass* | pending | pending |
| S7 | Settings save + restart | pending | pending | pending |
| S8 | MCP connect + tool call | pending | pending | pending |
| S9 | Index rebuild + semantic search | pending | pending | pending |
| S10 | Close during agent run → no data loss | pending | pending | pending |
| S11 | Large reasoning stream → no freeze | pass* | pending | pending |
| S12 | Package install → launch | pending | pending | pending |

\* Covered by unit tests / code review on Windows dev build. Full manual confirmation requires running the packaged app.
