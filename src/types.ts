import type { ElectronAPI } from '../../electron/preload'
import type {
  AgentContext,
  AgentEvent,
  AppSettings,
  ChatMessage,
  DirEntry,
  SkillInfo,
  SkillDraft,
  ModelEndpoint,
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
  ModelEndpoint,
  ModelInfo,
  SearchResult,
  SkillInfo,
  SkillDraft,
  UpdateInfo,
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
  AgentRunOutcome,
  RunCheckpointSummary,
  RunCheckpointFileDetail,
  InlineDiffRange,
  DeletedLineHighlight,
  InlineDeleteHighlight,
  TaskChecklistStepState,
  TaskChecklistState,
  ChatFileAttachment,
  ApprovedPlan,
  ApprovedPlanStep
} from '../../electron/types'
