import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  AgentEvent,
  AgentRunAnalytics,
  AppSettings,
  QueueDrainedSummary,
  QueueEnqueueInput,
  QueueSnapshot,
  QueuedRun,
  QueuedRunStatus,
  RunCheckpointSummary,
  TaskChecklistStepState,
  ToolApprovalRequest
} from '../types'
import { AppError, AppErrorCode } from '../lib/app-errors'
import type { AgentService } from './agent'

export const MAX_PENDING_TASKS = 20
export const MAX_TITLE_LENGTH = 120
export const MAX_PROMPT_LENGTH = 8000
export const MAX_CONCURRENT = 1
export const MAX_RETAINED_FINISHED = 20

const TAIL_MAX_LENGTH = 2000
const TAIL_THROTTLE_MS = 500
const SNAPSHOT_EMIT_DEBOUNCE_MS = 100
const PERSIST_DEBOUNCE_MS = 500

export interface RunQueueDeps {
  createAgentService: () => AgentService
  buildAgentContext: (
    overrides: Partial<import('../types').AgentContext>
  ) => import('../types').AgentContext
  emit: (event: AgentEvent) => void
  isForegroundRunning: () => boolean
  statePath?: string
}

export type TaskEnqueuer = (
  title: string,
  prompt: string,
  dependsOn: string[]
) => Promise<{ id: string; title: string; dependsOn: string[] }>

/** Pure: candidates = queued tasks whose deps are all completed, FIFO by createdAt. */
export function pickNextTasks(
  tasks: QueuedRun[],
  maxConcurrent: number,
  paused: boolean
): QueuedRun[] {
  if (paused) return []
  const activeCount = tasks.filter(
    (task) => task.status === 'running' || task.status === 'awaiting_approval'
  ).length
  if (activeCount >= maxConcurrent) return []

  const completedIds = new Set(
    tasks.filter((task) => task.status === 'completed').map((task) => task.id)
  )
  return tasks
    .filter(
      (task) =>
        task.status === 'queued' && task.dependsOn.every((dep) => completedIds.has(dep))
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, Math.max(0, maxConcurrent - activeCount))
}

/** Pure: dependents of a finished task; cancelled when the dep did not complete. */
export function resolveDependents(
  tasks: QueuedRun[],
  finishedId: string,
  finishedStatus: QueuedRunStatus
): Array<{ id: string; status: QueuedRunStatus; error?: string }> {
  if (finishedStatus === 'completed') return []
  return tasks
    .filter((task) => task.dependsOn.includes(finishedId) && task.status === 'queued')
    .map((task) => ({
      id: task.id,
      status: 'cancelled' as const,
      error: `Dependency ${finishedId} did not complete`
    }))
}

export type TailEventKind = 'text' | 'reasoning' | 'terminal' | 'tool'

/** Pure: append stream content to the task tail. Same-kind chunks flow inline;
 *  a kind change (or a tool lifecycle event) starts a new line. */
export function appendTailChunk(
  current: string,
  lastKind: TailEventKind | undefined,
  kind: TailEventKind,
  content: string
): { tail: string; lastKind: TailEventKind | undefined } {
  if (!content) {
    // Tool lifecycle events carry no content but act as line boundaries.
    return { tail: current, lastKind: kind === 'tool' ? 'tool' : lastKind }
  }
  const separator = current && (kind === 'terminal' || lastKind !== kind) ? '\n' : ''
  const next = `${current}${separator}${content}`
  return {
    tail: next.length > TAIL_MAX_LENGTH ? next.slice(-TAIL_MAX_LENGTH) : next,
    lastKind: kind
  }
}

/** Pure: validate enqueue input; throws AppError with queue.* codes. */
export function validateEnqueueInput(
  input: QueueEnqueueInput,
  tasks: QueuedRun[]
): void {
  const title = input.title?.trim() ?? ''
  const prompt = input.prompt?.trim() ?? ''
  if (!title) throw new AppError(AppErrorCode.QUEUE_TITLE_REQUIRED)
  if (!prompt) throw new AppError(AppErrorCode.QUEUE_PROMPT_REQUIRED)
  if (title.length > MAX_TITLE_LENGTH) throw new AppError(AppErrorCode.QUEUE_TITLE_TOO_LONG)
  if (prompt.length > MAX_PROMPT_LENGTH) throw new AppError(AppErrorCode.QUEUE_PROMPT_TOO_LONG)

  const pendingCount = tasks.filter(
    (task) => task.status === 'queued' || task.status === 'awaiting_approval'
  ).length
  if (pendingCount >= MAX_PENDING_TASKS) throw new AppError(AppErrorCode.QUEUE_TOO_MANY_PENDING)

  const knownIds = new Set(tasks.map((task) => task.id))
  const dependsOn = [...new Set(input.dependsOn ?? [])]
  for (const dep of dependsOn) {
    if (!knownIds.has(dep)) throw new AppError(AppErrorCode.QUEUE_UNKNOWN_DEP, { id: dep })
  }

  // Cycle detection: DFS from the new task over existing dep edges.
  const graph = new Map<string, string[]>()
  for (const task of tasks) graph.set(task.id, task.dependsOn)
  graph.set('__new__', dependsOn)
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const hasCycle = (node: string): boolean => {
    if (visited.has(node)) return false
    if (visiting.has(node)) return true
    visiting.add(node)
    for (const dep of graph.get(node) ?? []) {
      if (hasCycle(dep)) return true
    }
    visiting.delete(node)
    visited.add(node)
    return false
  }
  if (hasCycle('__new__')) throw new AppError(AppErrorCode.QUEUE_DEPENDENCY_CYCLE)
}

interface QueueStateFile {
  version: 1
  savedAt: string
  tasks: QueuedRun[]
  paused: boolean
  pausedReason: QueueSnapshot['pausedReason'] | null
}

export function serializeQueueState(tasks: QueuedRun[], paused: boolean): string {
  const state: QueueStateFile = {
    version: 1,
    savedAt: new Date().toISOString(),
    tasks: tasks.map((task) => ({
      ...task,
      approval: undefined,
      tail: undefined,
      checklist: undefined
    })),
    paused,
    pausedReason: null
  }
  return JSON.stringify(state)
}

/** Pure: apply load-time rules — unfinished → interrupted, unknown deps dropped, cap on queued. */
export function hydrateQueueState(
  raw: string | null,
  now: () => string = () => new Date().toISOString()
): { tasks: QueuedRun[]; paused: boolean } {
  if (!raw) return { tasks: [], paused: false }
  let parsed: QueueStateFile
  try {
    parsed = JSON.parse(raw) as QueueStateFile
  } catch {
    return { tasks: [], paused: false }
  }
  if (!parsed || !Array.isArray(parsed.tasks)) return { tasks: [], paused: false }

  const knownIds = new Set(parsed.tasks.map((task) => task.id))
  const tasks: QueuedRun[] = parsed.tasks.map((task) => ({
    ...task,
    dependsOn: (task.dependsOn ?? []).filter((dep) => knownIds.has(dep)),
    approval: undefined,
    tail: undefined,
    checklist: undefined
  }))

  const activeStatuses: QueuedRunStatus[] = ['queued', 'running', 'awaiting_approval']
  let queuedSeen = 0
  for (const task of tasks) {
    if (!activeStatuses.includes(task.status)) continue
    task.status = 'interrupted'
    task.error = 'App was closed while this task was running'
    task.endedAt = task.endedAt ?? now()
    if (task.status === 'interrupted' && queuedSeen < MAX_PENDING_TASKS) queuedSeen++
  }

  // Cap leftover queued tasks after load (they were interrupted above; keep the cap for future loads).
  let queuedCount = 0
  for (const task of tasks) {
    if (task.status !== 'queued') continue
    queuedCount++
    if (queuedCount > MAX_PENDING_TASKS) {
      task.status = 'cancelled'
      task.error = 'Too many pending tasks after restart'
    }
  }

  return { tasks, paused: parsed.paused === true }
}

export class RunQueueService {
  private tasks: QueuedRun[] = []
  private paused = false
  private pausedReason: QueueSnapshot['pausedReason']
  private drainedSummary: QueueDrainedSummary | null = null
  private wasActive = false
  private readonly instances = new Map<
    string,
    { service: AgentService; checkpoint: RunCheckpointSummary | null }
  >()
  private taskEnqueuer: TaskEnqueuer | null = null
  private readonly tailKinds = new Map<string, TailEventKind>()
  private snapshotTimer: ReturnType<typeof setTimeout> | null = null
  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private starting = new Set<string>()

  constructor(private readonly deps: RunQueueDeps) {}

  setTaskEnqueuer(enqueuer: TaskEnqueuer | null): void {
    this.taskEnqueuer = enqueuer
  }

  getTaskEnqueuer(): TaskEnqueuer | null {
    return this.taskEnqueuer
  }

  async load(): Promise<void> {
    if (!this.deps.statePath) return
    let raw: string | null = null
    try {
      raw = await readFile(this.deps.statePath, 'utf-8')
    } catch {
      raw = null
    }
    const hydrated = hydrateQueueState(raw)
    this.tasks = hydrated.tasks
    this.paused = hydrated.paused
    this.pausedReason = hydrated.paused ? 'user' : undefined
    this.emitSnapshot()
  }

  enqueue(input: QueueEnqueueInput): QueuedRun {
    // Derive the title BEFORE validation: an empty title falls back to the
    // first words of the prompt instead of failing with queue.titleRequired.
    const title = input.title?.trim() || deriveTaskTitle(input.prompt)
    validateEnqueueInput({ ...input, title }, this.tasks)
    const task: QueuedRun = {
      id: `qtask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      prompt: input.prompt.trim(),
      status: 'queued',
      source: input.source,
      dependsOn: [...new Set(input.dependsOn ?? [])],
      createdAt: new Date().toISOString()
    }
    this.tasks.push(task)
    this.drainedSummary = null
    this.schedulePersist()
    this.emitSnapshot()
    this.maybeStartNext()
    return task
  }

  cancel(runId: string): QueuedRun {
    const task = this.tasks.find((t) => t.id === runId)
    if (!task) throw new AppError(AppErrorCode.QUEUE_TASK_NOT_FOUND)
    if (task.status !== 'queued' && task.status !== 'running' && task.status !== 'awaiting_approval') {
      throw new AppError(AppErrorCode.QUEUE_TASK_NOT_ACTIVE)
    }
    if (task.status === 'queued') {
      task.status = 'cancelled'
      task.endedAt = new Date().toISOString()
      this.schedulePersist()
      this.emitSnapshot()
      this.maybeStartNext()
      return task
    }
    // running / awaiting_approval: abort the instance; final status arrives via done/error event.
    this.instances.get(runId)?.service.abort()
    return task
  }

  clearFinished(): void {
    const finished = new Set(
      this.tasks
        .filter(
          (task) =>
            task.status === 'completed' ||
            task.status === 'error' ||
            task.status === 'aborted' ||
            task.status === 'max_iterations' ||
            task.status === 'cancelled' ||
            task.status === 'interrupted'
        )
        .map((task) => task.id)
    )
    this.tasks = this.tasks.filter((task) => !finished.has(task.id))
    for (const id of finished) {
      this.instances.delete(id)
      this.tailKinds.delete(id)
    }
    this.drainedSummary = null
    this.schedulePersist()
    this.emitSnapshot()
  }

  setPaused(paused: boolean, reason?: QueueSnapshot['pausedReason']): void {
    this.paused = paused
    this.pausedReason = paused ? (reason ?? 'user') : undefined
    this.schedulePersist()
    this.emitSnapshot()
    if (!paused) this.maybeStartNext()
  }

  getPaused(): boolean {
    return this.paused
  }

  list(): QueueSnapshot {
    const active = this.tasks
      .filter(
        (task) =>
          task.status === 'queued' ||
          task.status === 'running' ||
          task.status === 'awaiting_approval'
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const finished = this.tasks
      .filter(
        (task) =>
          task.status !== 'queued' &&
          task.status !== 'running' &&
          task.status !== 'awaiting_approval'
      )
      .sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''))
    return {
      tasks: [...active, ...finished],
      paused: this.paused,
      pausedReason: this.pausedReason,
      drainedSummary: this.drainedSummary ?? undefined,
      maxConcurrent: MAX_CONCURRENT
    }
  }

  hasActiveRuns(): boolean {
    return this.tasks.some(
      (task) => task.status === 'running' || task.status === 'awaiting_approval'
    )
  }

  resolveApproval(runId: string, approvalId: string, approved: boolean): void {
    const entry = this.instances.get(runId)
    if (!entry) return
    entry.service.resolveApproval(approvalId, approved)
  }

  async getRunCheckpointDetails(runId: string) {
    const entry = this.instances.get(runId)
    if (!entry) throw new AppError(AppErrorCode.QUEUE_TASK_NOT_FOUND)
    return entry.service.getRunCheckpointDetails()
  }

  async restoreRunCheckpoint(runId: string, paths?: string[]) {
    if (this.hasActiveRuns()) throw new AppError(AppErrorCode.QUEUE_RESTORE_WHILE_BUSY)
    const entry = this.instances.get(runId)
    if (!entry) throw new AppError(AppErrorCode.QUEUE_TASK_NOT_FOUND)
    return paths && paths.length > 0
      ? entry.service.restoreRunCheckpointPaths(paths)
      : entry.service.restoreRunCheckpoint()
  }

  async abortAll(reason: 'foreground' | 'renderer-gone' | 'shutdown'): Promise<void> {
    const active = this.tasks.filter(
      (task) => task.status === 'running' || task.status === 'awaiting_approval'
    )
    await Promise.all(
      active.map(async (task) => {
        const entry = this.instances.get(task.id)
        if (!entry) {
          task.status = 'cancelled'
          task.endedAt = new Date().toISOString()
          task.error = `Aborted (${reason})`
          return
        }
        entry.service.abort()
        // Wait for the run() promise to settle so the workspace has a single writer again.
        await new Promise<void>((resolve) => {
          const check = (): void => {
            if (task.status !== 'running' && task.status !== 'awaiting_approval') resolve()
            else setTimeout(check, 25)
          }
          check()
        })
      })
    )
  }

  private async startTask(task: QueuedRun): Promise<void> {
    // Re-check status synchronously before any await (re-entrancy guard).
    if (task.status !== 'queued' || this.starting.has(task.id)) return
    this.starting.add(task.id)
    task.status = 'running'
    task.startedAt = new Date().toISOString()
    this.emitSnapshot()

    const service = this.deps.createAgentService()
    const enqueuer = this.taskEnqueuer
    if (enqueuer) {
      service.setTaskEnqueuer?.(async (title, prompt, dependsOn) => {
        const created = this.enqueue({ title, prompt, dependsOn, source: 'agent' })
        return { id: created.id, title: created.title, dependsOn: created.dependsOn }
      })
    }

    this.instances.set(task.id, { service, checkpoint: null })

    const interpret = (event: AgentEvent): void => {
      this.interpretEvent(task, event)
    }

    try {
      await service.run(
        task.prompt,
        this.deps.buildAgentContext({
          mode: 'agent',
          approvalTimeoutMs: 0,
          runQueueEnabled: this.taskEnqueuer != null
        }),
        interpret
      )
    } catch (err) {
      task.status = 'error'
      task.endedAt = new Date().toISOString()
      task.error = err instanceof Error ? err.message : String(err)
      task.analytics = undefined
    } finally {
      this.starting.delete(task.id)
      if (task.status === 'running' || task.status === 'awaiting_approval') {
        // run() returned without a terminal event (should not happen) — finalize defensively.
        task.status = 'error'
        task.endedAt = new Date().toISOString()
        task.error = 'Run ended without a terminal event'
      }
      this.afterTaskFinished(task)
    }
  }

  private interpretEvent(task: QueuedRun, event: AgentEvent): void {
    switch (event.type) {
      case 'stream':
      case 'reasoning_stream':
      case 'tool_start':
      case 'tool_progress':
      case 'tool_done':
      case 'terminal_output': {
        const kind: TailEventKind =
          event.type === 'stream'
            ? 'text'
            : event.type === 'reasoning_stream'
              ? 'reasoning'
              : event.type === 'terminal_output'
                ? 'terminal'
                : 'tool'
        this.appendTail(task, kind, event.content ?? '')
        break
      }
      case 'run_status':
        if (event.runStatus === 'running' || event.runStatus === 'awaiting_approval') {
          task.status = event.runStatus
          this.scheduleSnapshotEmit()
        }
        break
      case 'checkpoint_updated':
        if (event.checkpoint) {
          task.checkpoint = event.checkpoint
          const entry = this.instances.get(task.id)
          if (entry) entry.checkpoint = event.checkpoint
          this.scheduleSnapshotEmit()
        }
        break
      case 'checklist_updated':
        if (event.checklist) {
          task.checklist = event.checklist.steps
          this.scheduleSnapshotEmit()
        }
        break
      case 'approval_request':
        task.approval = event.approval
        task.status = 'awaiting_approval'
        this.scheduleSnapshotEmit()
        break
      case 'run_analytics':
        task.analytics = event.analytics
        break
      case 'done':
        this.finalizeFromDone(task, event)
        break
      case 'error':
        task.status = 'error'
        task.endedAt = new Date().toISOString()
        task.error = event.error ?? 'Unknown error'
        task.approval = undefined
        this.scheduleSnapshotEmit()
        break
      default:
        break
    }
  }

  private finalizeFromDone(task: QueuedRun, event: AgentEvent): void {
    const outcome = event.message?.runOutcome
    const status: QueuedRunStatus =
      outcome === 'success'
        ? 'completed'
        : outcome === 'aborted'
          ? 'aborted'
          : outcome === 'max_iterations'
            ? 'max_iterations'
            : 'error'
    task.status = status
    task.endedAt = new Date().toISOString()
    task.analytics = event.message?.runAnalytics ?? task.analytics
    task.approval = undefined
    if (status === 'error' && !task.error) {
      task.error = event.message?.content || 'Run failed'
    }
    this.scheduleSnapshotEmit()
  }

  private afterTaskFinished(task: QueuedRun): void {
    for (const { id, status, error } of resolveDependents(this.tasks, task.id, task.status)) {
      const dependent = this.tasks.find((t) => t.id === id)
      if (dependent) {
        dependent.status = status
        dependent.endedAt = new Date().toISOString()
        dependent.error = error
      }
    }
    this.schedulePersist()
    this.emitSnapshot()
    this.maybeStartNext()
  }

  private appendTail(task: QueuedRun, kind: TailEventKind, content: string): void {
    const current = task.tail ?? ''
    const previous = this.tailKinds.get(task.id)
    const applied = appendTailChunk(current, previous, kind, content)
    if (applied.tail === current && applied.lastKind === previous) return
    task.tail = applied.tail
    if (applied.lastKind !== undefined) this.tailKinds.set(task.id, applied.lastKind)
    this.scheduleSnapshotEmit()
  }

  private maybeStartNext(): void {
    if (this.paused) return
    if (this.hasActiveRuns()) return
    const candidates = pickNextTasks(this.tasks, MAX_CONCURRENT, this.paused)
    if (candidates.length === 0) return
    void this.startTask(candidates[0])
  }

  private scheduleSnapshotEmit(): void {
    if (this.snapshotTimer) return
    this.snapshotTimer = setTimeout(() => {
      this.snapshotTimer = null
      this.emitSnapshot()
    }, SNAPSHOT_EMIT_DEBOUNCE_MS)
  }

  private emitSnapshot(): void {
    this.updateDrainedSummary()
    this.deps.emit({
      type: 'queue_updated',
      queue: JSON.parse(JSON.stringify(this.list())) as QueueSnapshot
    })
  }

  private updateDrainedSummary(): void {
    const activeCount = this.tasks.filter(
      (task) =>
        task.status === 'queued' ||
        task.status === 'running' ||
        task.status === 'awaiting_approval'
    ).length
    const finishedCount = this.tasks.length - activeCount
    if (activeCount === 0 && finishedCount > 0) {
      if (!this.drainedSummary && this.wasActive) {
        this.drainedSummary = {
          total: this.tasks.length,
          completed: this.tasks.filter((t) => t.status === 'completed').length,
          error: this.tasks.filter(
            (t) => t.status === 'error' || t.status === 'aborted' || t.status === 'max_iterations'
          ).length,
          awaitingApproval: 0
        }
      }
      this.wasActive = false
    } else if (activeCount > 0) {
      this.wasActive = true
    }
  }

  private schedulePersist(): void {
    if (!this.deps.statePath || this.persistTimer) return
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      void this.persistNow()
    }, PERSIST_DEBOUNCE_MS)
  }

  private async persistNow(): Promise<void> {
    if (!this.deps.statePath) return
    try {
      await mkdir(join(this.deps.statePath, '..'), { recursive: true })
      const tmp = `${this.deps.statePath}.tmp`
      await writeFile(tmp, serializeQueueState(this.tasks, this.paused), 'utf-8')
      await rm(this.deps.statePath, { force: true })
      await rename(tmp, this.deps.statePath)
    } catch (err) {
      console.error('[RunQueue] Failed to persist state:', err)
    }
  }
}

/** Derive a short task title from the prompt: first meaningful words, no newlines. */
export function deriveTaskTitle(prompt: string): string {
  const words = prompt
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  const title = words.slice(0, 6).join(' ')
  return title.length > 60 ? title.slice(0, 57) + '…' : title || 'Untitled task'
}
