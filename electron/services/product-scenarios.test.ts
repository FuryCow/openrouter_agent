import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir, platform } from 'os'
import { buildSystemPrompt, getMaxIterations, getToolsForMode, modeRequiresWorkspace } from './agent-modes'
import { validateToolArguments } from './tool-analytics'
import { isPlannerPlanPath, writePlannerPlan } from './planner-plans'
import { filterWatcherPaths, listWorkspaceFiles, resolveWatcherFileSet } from './indexing/workspace-files'
import { buildUserMessageWithAttachments } from '../lib/attached-files'
import { appendTimelineChunk } from '../../src/lib/timeline'
import { formatApprovedPlanForPrompt, parsePlannerPlan } from '../../src/lib/parsePlannerPlan'
import type { AgentContext, ChatMode } from '../types'
import type { ToolDefinition } from './openrouter'

vi.mock('electron', () => ({
  app: {
    getPath: () => globalThis.__productUserData as string
  }
}))

declare global {
  var __productUserData: string
}

const ACTIONS = [
  'read_files',
  'grep_workspace',
  'codebase_search',
  'list_directory',
  'search_replace',
  'write_file',
  'run_terminal'
].map(
  (name): ToolDefinition => ({
    type: 'function',
    function: { name, description: '', parameters: { type: 'object', properties: {} } }
  })
)

function offeredActions(mode: ChatMode): string[] {
  return getToolsForMode(mode, ACTIONS).map((tool) => tool.function.name)
}

function requestAccepted(mode: ChatMode, action: string, args: Record<string, unknown>): boolean {
  return validateToolArguments(action, JSON.stringify(args), mode).ok
}

const project: AgentContext = {
  mode: 'ask',
  workingDirectory: '/proj',
  openFiles: [],
  history: [],
  model: 'test/model'
}

describe('asking about the open project', () => {
  it('lets the user look up code and refuses edits, the terminal, and MCP', () => {
    expect(offeredActions('ask')).toEqual([
      'read_files',
      'grep_workspace',
      'codebase_search',
      'list_directory'
    ])
    expect(requestAccepted('ask', 'read_files', { paths: ['src/app.ts'] })).toBe(true)
    expect(requestAccepted('ask', 'write_file', { path: 'src/app.ts', content: 'x' })).toBe(false)
    expect(requestAccepted('ask', 'search_replace', { path: 'src/app.ts', old_string: 'a', new_string: 'b' })).toBe(
      false
    )
    expect(requestAccepted('ask', 'run_terminal', { command: 'npm test' })).toBe(false)
    expect(requestAccepted('ask', 'mcp__srv__read_file', { path: 'src/app.ts' })).toBe(false)
    expect(requestAccepted('ask', 'read_files', { paths: [] })).toBe(false)
    expect(requestAccepted('ask', 'read_files', { paths: Array.from({ length: 11 }, (_, i) => `f${i}.ts`) })).toBe(
      false
    )
  })

  it('includes the open editor file in the question so the user does not have to paste it', () => {
    const prompt = buildSystemPrompt({
      ...project,
      openFiles: [{ path: 'src/app.ts', language: 'typescript', content: 'export const answer = 42' }]
    })
    expect(prompt).toContain('export const answer = 42')
    expect(prompt).toContain('cannot modify files')
  })

  it('answers from an attachment instead of whatever happens to be open in the editor', () => {
    const prompt = buildSystemPrompt({
      ...project,
      openFiles: [{ path: 'src/app.ts', language: 'typescript', content: 'export const answer = 42' }],
      attachedFiles: [{ name: 'notes.md', content: 'the attached note' }]
    })
    const question = buildUserMessageWithAttachments('что в файле?', [
      { name: 'notes.md', content: 'the attached note' }
    ])
    expect(question).toContain('the attached note')
    expect(prompt).toContain('notes.md')
    expect(prompt).not.toContain('export const answer = 42')
  })

  it('still answers when no folder is open, unlike planning or editing', () => {
    const prompt = buildSystemPrompt({ ...project, workingDirectory: '' })
    expect(prompt).toContain('not set')
    expect(modeRequiresWorkspace('ask')).toBe(false)
    expect(modeRequiresWorkspace('planner')).toBe(true)
    expect(modeRequiresWorkspace('agent')).toBe(true)
  })

  it('does not stop a long question at 50 steps', () => {
    expect(getMaxIterations('ask')).toBeGreaterThan(50)
    expect(getMaxIterations('planner')).toBeGreaterThan(50)
    expect(getMaxIterations('agent')).toBeGreaterThan(50)
  })
})

describe('planning a change', () => {
  it('can edit a saved plan and cannot edit project source', () => {
    const workspace = join(tmpdir(), 'product-plan')
    expect(requestAccepted('planner', 'grep_workspace', { query: 'answer' })).toBe(true)
    expect(
      requestAccepted('planner', 'search_replace', {
        path: '.openrouter/plans/camera.md',
        old_string: 'old',
        new_string: 'new'
      })
    ).toBe(true)
    expect(
      requestAccepted('planner', 'search_replace', {
        path: 'src/app.ts',
        old_string: 'old',
        new_string: 'new'
      })
    ).toBe(false)
    expect(requestAccepted('planner', 'write_file', { path: 'src/app.ts', content: 'x' })).toBe(false)
    expect(requestAccepted('planner', 'run_terminal', { command: 'npm test' })).toBe(false)
    expect(isPlannerPlanPath(workspace, join(workspace, 'src', 'app.ts'))).toBe(false)
    expect(isPlannerPlanPath(workspace, join(workspace, '..', 'other', '.openrouter', 'plans', 'x.md'))).toBe(
      false
    )
    expect(
      requestAccepted('planner', 'search_replace', {
        path: '.openrouter/plans/../src/secret.md',
        old_string: 'a',
        new_string: 'b'
      })
    ).toBe(false)
    expect(
      requestAccepted('planner', 'search_replace', {
        path: '.openrouter/plans/note.txt',
        old_string: 'a',
        new_string: 'b'
      })
    ).toBe(false)
    expect(
      requestAccepted('planner', 'search_replace', {
        path: '.openrouter\\plans\\camera.md',
        old_string: 'a',
        new_string: 'b'
      })
    ).toBe(true)
  })

  it('rejects a plan path that only looks local because it sits on another drive', () => {
    if (platform() !== 'win32') return
    expect(isPlannerPlanPath('C:\\proj', 'D:\\elsewhere\\.openrouter\\plans\\x.md')).toBe(false)
  })

  it('keeps both plans when the user saves twice in a row', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'product-plans-'))
    const first = await writePlannerPlan(dir, '# Камера\n\nПервый черновик')
    const second = await writePlannerPlan(dir, '# Камера\n\nВторой черновик')

    expect(first).not.toBe(second)
    expect(readFileSync(join(dir, first), 'utf-8')).toContain('Первый черновик')
    expect(readFileSync(join(dir, second), 'utf-8')).toContain('Второй черновик')
    expect(first).toContain('камера')
    rmSync(dir, { recursive: true, force: true })
  })

  it('hands the saved plan to the agent as ordered steps, not as a raw dump', () => {
    const plan = parsePlannerPlan(`## Цель
Починить камеру

## Шаги
1. Прочитать \`src/camera.ts\`
2. Поправить отсечение

## Файлы
- src/camera.ts

## Проверка
- сцена с кустом всё ещё видна`)
    const handoff = formatApprovedPlanForPrompt(plan)

    expect(handoff).toContain('Починить камеру')
    expect(handoff.indexOf('1. Прочитать')).toBeLessThan(handoff.indexOf('2. Поправить'))
    expect(handoff).toContain('src/camera.ts')
    expect(handoff).toContain('сцена с кустом')
  })

  it('keeps a plan whose title is only punctuation, and still hands off steps written out of order', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'product-plan-empty-'))
    const saved = await writePlannerPlan(dir, '!!!')
    expect(saved).toContain('-plan.md')
    expect(readFileSync(join(dir, saved), 'utf-8')).toContain('!!!')
    rmSync(dir, { recursive: true, force: true })

    const plan = parsePlannerPlan(`## Цель проекта
Не потерять порядок

## Шаги
2. Второй
1) Первый`)
    const handoff = formatApprovedPlanForPrompt(plan)
    expect(handoff).toContain('Не потерять порядок')
    expect(handoff.indexOf('1. Первый')).toBeLessThan(handoff.indexOf('2. Второй'))

    const empty = formatApprovedPlanForPrompt(parsePlannerPlan('просто мысль'))
    expect(empty).not.toContain('1.')
    expect(empty).toContain('Do not skip verification')
  })
})

describe('what the project index shows', () => {
  it('shows source and saved plans, and hides dependency and tool folders', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'product-index-'))
    mkdirSync(join(dir, 'src'), { recursive: true })
    mkdirSync(join(dir, 'node_modules', 'pkg'), { recursive: true })
    mkdirSync(join(dir, 'dist'), { recursive: true })
    mkdirSync(join(dir, '.cursor'), { recursive: true })
    mkdirSync(join(dir, '.openrouter', 'plans'), { recursive: true })
    writeFileSync(join(dir, 'src', 'app.ts'), 'export const answer = 1', 'utf-8')
    writeFileSync(join(dir, 'node_modules', 'pkg', 'index.js'), 'x', 'utf-8')
    writeFileSync(join(dir, 'dist', 'app.js'), 'x', 'utf-8')
    writeFileSync(join(dir, '.cursor', 'rules.md'), 'x', 'utf-8')
    writeFileSync(join(dir, '.openrouter', 'plans', 'camera.md'), '# camera', 'utf-8')

    const visible = await listWorkspaceFiles(dir)
    expect(visible).toContain('src/app.ts')
    expect(visible).toContain('.openrouter/plans/camera.md')
    expect(visible).not.toContain('node_modules/pkg/index.js')
    expect(visible).not.toContain('dist/app.js')
    expect(visible).not.toContain('.cursor/rules.md')
    rmSync(dir, { recursive: true, force: true })
  })

  it('includes a file the user just saved when that save is reported', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'product-watch-'))
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src', 'old.ts'), 'export {}', 'utf-8')
    await resolveWatcherFileSet(dir, ['src/old.ts'], new Set())

    writeFileSync(join(dir, 'src', 'new.ts'), 'export const fresh = 1', 'utf-8')
    const visible = await resolveWatcherFileSet(dir, ['src/new.ts'], new Set(['src/old.ts']))
    expect(visible.has('src/new.ts')).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })

  it('hides files the project itself ignores, and still notices a deleted indexed file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'product-ignore-'))
    writeFileSync(join(dir, '.gitignore'), '*.log\n', 'utf-8')
    writeFileSync(join(dir, 'keep.ts'), 'export {}', 'utf-8')
    writeFileSync(join(dir, 'debug.log'), 'noise', 'utf-8')

    const visible = await listWorkspaceFiles(dir)
    expect(visible).toContain('keep.ts')
    expect(visible).not.toContain('debug.log')
    rmSync(dir, { recursive: true, force: true })

    expect(
      filterWatcherPaths(['src/gone.ts', '.'], new Set(['src/app.ts']), new Set(['src/gone.ts']))
    ).toEqual(['src/gone.ts'])
  })
})

describe('chat follows the open project', () => {
  beforeEach(() => {
    globalThis.__productUserData = mkdtempSync(join(tmpdir(), 'product-chat-'))
    vi.resetModules()
  })

  afterEach(() => {
    rmSync(globalThis.__productUserData, { recursive: true, force: true })
  })

  it('does not show one project chat inside another', async () => {
    const { saveChatMessages, loadChatMessages } = await import('./chat-persistence')
    const alpha = join(tmpdir(), 'alpha')
    const beta = join(tmpdir(), 'beta')

    await saveChatMessages('agent', [{ id: 'user-1', role: 'user', content: 'only alpha', mode: 'agent' }], alpha)

    expect(await loadChatMessages('agent', beta)).toEqual([])
    expect((await loadChatMessages('agent', alpha))[0]?.content).toBe('only alpha')
  })

  it('keeps the agent conversation when the user clears Ask', async () => {
    const { saveChatMessages, loadChatMessages } = await import('./chat-persistence')
    const workspace = join(tmpdir(), 'mixed-modes')

    await saveChatMessages('agent', [{ id: 'user-1', role: 'user', content: 'keep me', mode: 'agent' }], workspace)
    await saveChatMessages('ask', [{ id: 'user-2', role: 'user', content: 'question', mode: 'ask' }], workspace)
    await saveChatMessages('ask', [], workspace, { allowEmpty: true })

    expect(await loadChatMessages('ask', workspace)).toEqual([])
    expect((await loadChatMessages('agent', workspace))[0]?.content).toBe('keep me')
  })

  it('does not wipe the conversation when an empty autosave races a real one', async () => {
    const { saveChatMessages, loadChatMessages } = await import('./chat-persistence')
    const workspace = join(tmpdir(), 'race')

    await saveChatMessages(
      'planner',
      [{ id: 'user-1', role: 'user', content: 'the plan', mode: 'planner' }],
      workspace
    )
    await saveChatMessages('planner', [], workspace)

    expect((await loadChatMessages('planner', workspace))[0]?.content).toBe('the plan')
  })

  it('treats a trailing slash and backslashes as the same project', async () => {
    const { saveChatMessages, loadChatMessages } = await import('./chat-persistence')
    const folder = join(tmpdir(), 'SameProject')

    await saveChatMessages(
      'agent',
      [{ id: 'user-1', role: 'user', content: 'same room', mode: 'agent' }],
      folder + '/'
    )

    expect((await loadChatMessages('agent', folder))[0]?.content).toBe('same room')
    expect((await loadChatMessages('agent', folder.replace(/\\/g, '/') + '\\'))[0]?.content).toBe('same room')
  })

  it('opens a damaged chat as empty, and only a real new message replaces it', async () => {
    const { saveChatMessages, loadChatMessages } = await import('./chat-persistence')
    const { hashWorkspacePath } = await import('./indexing/index-paths')
    const workspace = join(tmpdir(), 'damaged')
    const filePath = join(globalThis.__productUserData, 'chats', hashWorkspacePath(workspace), 'agent.json')
    mkdirSync(join(filePath, '..'), { recursive: true })
    writeFileSync(filePath, '{"not":"a transcript"}')

    expect(await loadChatMessages('agent', workspace)).toEqual([])
    await saveChatMessages('agent', [], workspace)
    expect(readFileSync(filePath, 'utf-8')).toBe('{"not":"a transcript"}')

    await saveChatMessages(
      'agent',
      [{ id: 'user-2', role: 'user', content: 'start again', mode: 'agent' }],
      workspace
    )
    expect((await loadChatMessages('agent', workspace))[0]?.content).toBe('start again')
  })

  it('keeps a chat with no open folder until the first empty project is opened', async () => {
    const { saveChatMessages, loadChatMessages } = await import('./chat-persistence')
    const projectDir = join(tmpdir(), 'real-project')
    const laterProject = join(tmpdir(), 'later-project')

    await saveChatMessages(
      'agent',
      [{ id: 'user-1', role: 'user', content: 'scratch', mode: 'agent' }],
      '   '
    )

    expect((await loadChatMessages('agent', null))[0]?.content).toBe('scratch')
    expect((await loadChatMessages('agent', projectDir))[0]?.content).toBe('scratch')
    expect(await loadChatMessages('agent', laterProject)).toEqual([])
  })
})

describe('watching an answer stream in', () => {
  it('keeps a word split across chunks inside the thinking, and shows a plan list as the answer', () => {
    const thinking = appendTimelineChunk([], 'reasoning', 'Принято — масштаб')
    const stillThinking = appendTimelineChunk(thinking, 'text', 'ируем от леса')
    expect(stillThinking).toHaveLength(1)
    expect(stillThinking[0]?.type).toBe('reasoning')

    const withPlan = appendTimelineChunk(thinking, 'text', '- Прочитать камеру\n- Поправить отсечение')
    expect(withPlan.map((item) => item.type)).toEqual(['reasoning', 'text'])
    expect(withPlan[1]?.type === 'text' && withPlan[1].content).toContain('Прочитать камеру')
  })
})
