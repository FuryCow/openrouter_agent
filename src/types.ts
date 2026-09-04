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
  DiffHighlightRange,
  DiffDisplayLine,
  FileDiffPreview,
  IndexStatus,
  IndexProgress,
  CodebaseSearchRequest,
  CodebaseSearchHit,
  CodebaseSearchMode
} from '../../electron/types'
