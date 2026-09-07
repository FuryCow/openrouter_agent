import type { ElectronAPI } from '../../electron/preload'
import type {
  AgentContext,
  AgentEvent,
  AppSettings,
  ChatMessage,
  DirEntry,
  ModelInfo,
  SearchResult
} from '../../electron/types'

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export type {
  AgentContext,
  AgentEvent,
  AppSettings,
  ChatMessage,
  ChatMode,
  DirEntry,
  ModelInfo,
  SearchResult,
  TimelineItem,
  ToolCallInfo,
  AgentRunAnalytics,
  ToolCallAnalytics,
  ToolValidationIssue,
  ApiChatMessage,
  ToolApprovalRequest,
  MemorySuggestRequest,
  MemorySuggestEntry,
  DiffHighlightRange,
  DiffDisplayLine,
  FileDiffPreview,
  IndexStatus,
  IndexProgress,
  CodebaseSearchRequest,
  CodebaseSearchHit,
  CodebaseSearchMode,
  TokenUsage,
  McpServerConfig,
  McpServerStatus,
  McpStatusSnapshot,
  McpTransportType,
  ProjectMemoryEntry,
  ProjectMemoryCategory,
  AgentRunStatus,
  RunCheckpointSummary
} from '../../electron/types'
