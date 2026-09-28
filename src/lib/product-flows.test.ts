import { beforeEach, describe, expect, it } from 'vitest'
import { handleAgentEvent } from './agentEvents'
import { formatAppVersionLabel } from './appVersionLabel'
import { prepareImplementPlan } from './implementPlan'
import { useAgentRunStore } from '@/stores/agentRunStore'
import { useChatStore } from '@/stores/chatStore'
import { useToastStore } from '@/stores/toastStore'
import type { ChatMessage } from '@/types'
import { suggestMemoryFromRun } from '../../electron/services/project-memory/run-memory-suggest'

const plan = `# План

Цель
Починить камеру

Шаги
1. Открыть Camera.ts
2. Поправить фокус
`

function user(content: string, mode: ChatMessage['mode']): ChatMessage {
  return { id: content, role: 'user', content, mode }
}

describe('implementing an approved plan', () => {
  it('sends the planner task, not a later agent message, ahead of the steps', () => {
    const prepared = prepareImplementPlan({
      isStreaming: false,
      messages: [
        user('Сделать зум', 'planner'),
        { id: 'draft', role: 'assistant', content: 'черновик плана', mode: 'planner' },
        user('ignore me', 'agent')
      ],
      planContent: plan
    })

    expect(prepared.ready).toBe(true)
    if (!prepared.ready) return
    expect(prepared.prompt.startsWith('Original user task:\nСделать зум\n\n')).toBe(true)
    expect(prepared.prompt).toContain('Открыть Camera.ts')
    expect(prepared.prompt).not.toContain('ignore me')
    expect(prepared.approvedPlan.steps.map((step) => step.text)).toEqual([
      'Открыть Camera.ts',
      'Поправить фокус'
    ])
  })

  it('sends only the plan when the planner never asked for anything', () => {
    const prepared = prepareImplementPlan({
      isStreaming: false,
      messages: [user('ignore me', 'agent')],
      planContent: plan
    })

    expect(prepared.ready).toBe(true)
    if (!prepared.ready) return
    expect(prepared.prompt).toBe(
      'Implement according to the plan below. Execute steps in order, use tools, and do not deviate from the plan unless necessary.\n\n---\n\n' +
        plan
    )
  })

  it('does nothing while an answer is still streaming', () => {
    expect(
      prepareImplementPlan({
        isStreaming: true,
        messages: [user('Починить камеру', 'planner')],
        planContent: plan
      })
    ).toEqual({ ready: false })
  })
})

describe('the window shows the app version', () => {
  it('labels a plain version and hides an empty one', () => {
    expect(formatAppVersionLabel('1.0.0-alpha.2')).toBe('v1.0.0-alpha.2')
    expect(formatAppVersionLabel('v1.0.0-alpha.2')).toBe('v1.0.0-alpha.2')
    expect(formatAppVersionLabel('  ')).toBe('')
    expect(formatAppVersionLabel(null)).toBe('')
  })
})

describe('a running agent in the chat', () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      isStreaming: true,
      pendingApproval: null,
      pendingMemorySuggest: null,
      activeTimeline: []
    })
    useAgentRunStore.setState({
      runStatus: 'running',
      checkpoint: null,
      checklist: null,
      changesPanelDismissed: true,
      lastTerminalOutput: null
    })
    useToastStore.setState({ toasts: [] })
  })

  it('asks before writing a file', () => {
    handleAgentEvent({
      type: 'run_status',
      runStatus: 'awaiting_approval'
    })
    handleAgentEvent({
      type: 'approval_request',
      approval: {
        id: 'a1',
        toolCallId: 't1',
        name: 'write_file',
        arguments: '{"path":"src/Camera.ts"}',
        filePath: 'src/Camera.ts',
        preview: 'Write src/Camera.ts'
      }
    })

    expect(useAgentRunStore.getState().runStatus).toBe('awaiting_approval')
    expect(useChatStore.getState().pendingApproval).toMatchObject({
      name: 'write_file',
      filePath: 'src/Camera.ts'
    })
  })

  it('stops the spinner and keeps an interrupted answer when the run is aborted', () => {
    handleAgentEvent({ type: 'run_status', runStatus: 'aborted' })
    handleAgentEvent({
      type: 'done',
      message: {
        id: 'm1',
        role: 'assistant',
        content: 'Stopped.',
        interrupted: true,
        runOutcome: 'aborted'
      }
    })

    expect(useChatStore.getState().isStreaming).toBe(false)
    expect(useAgentRunStore.getState().runStatus).toBe('aborted')
    expect(useChatStore.getState().messages.at(-1)).toMatchObject({
      interrupted: true,
      content: 'Stopped.'
    })
  })

  it('offers to remember a run that changed a file, and a short answer stays quiet', () => {
    const quiet = suggestMemoryFromRun([], 'ok')
    expect(quiet).toEqual([])

    const suggestions = suggestMemoryFromRun(
      [
        {
          id: 'tool-1',
          type: 'tool',
          toolCall: {
            id: 't1',
            name: 'write_file',
            arguments: '{}',
            status: 'done',
            filePath: 'src/Camera.ts'
          }
        }
      ],
      'Updated the camera focus so the preview stays sharp.'
    )
    expect(suggestions[0]?.content).toContain('src/Camera.ts')

    handleAgentEvent({
      type: 'memory_suggest',
      memorySuggest: { id: 'mem-1', entries: suggestions }
    })
    expect(useChatStore.getState().pendingMemorySuggest?.entries[0]?.content).toContain(
      'src/Camera.ts'
    )

    useChatStore.getState().setPendingMemorySuggest(null)
    expect(useChatStore.getState().pendingMemorySuggest).toBeNull()
  })

  it('shows checklist steps as the agent marks them', () => {
    handleAgentEvent({
      type: 'checklist_updated',
      checklist: {
        steps: [
          { text: 'Открыть Camera.ts', status: 'done' },
          { text: 'Поправить фокус', status: 'in_progress' }
        ]
      }
    })

    expect(useAgentRunStore.getState().checklist).toEqual([
      { text: 'Открыть Camera.ts', status: 'done' },
      { text: 'Поправить фокус', status: 'in_progress' }
    ])
  })

  it('opens the changes list when a checkpoint is saved', () => {
    handleAgentEvent({
      type: 'checkpoint_updated',
      checkpoint: { paths: ['src/Camera.ts'], count: 1 }
    })

    expect(useAgentRunStore.getState().checkpoint).toEqual({
      paths: ['src/Camera.ts'],
      count: 1
    })
    expect(useAgentRunStore.getState().changesPanelDismissed).toBe(false)
  })

  it('stops the spinner and shows the error when the answer fails', () => {
    handleAgentEvent({ type: 'error', error: 'The model request failed.' })

    expect(useChatStore.getState().isStreaming).toBe(false)
    expect(useChatStore.getState().messages.at(-1)?.isError).toBe(true)
    expect(useToastStore.getState().toasts.at(-1)?.message).toContain('failed')
  })
})
