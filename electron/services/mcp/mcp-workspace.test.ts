import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveWorkspaceMcpServers, scheduleWorkspaceMcpReconnect, writeWorkspaceMcpOverride } from './mcp-workspace'
import type { McpServerConfig } from '../../types'

const globalDocs: McpServerConfig = {
  id: 'docs',
  enabled: true,
  transport: 'stdio',
  command: 'npx',
  args: ['docs']
}

const globalGit: McpServerConfig = {
  id: 'git',
  enabled: true,
  transport: 'stdio',
  command: 'git-mcp'
}

describe('workspace MCP override', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  function workspace(): string {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-workspace-'))
    dirs.push(dir)
    return dir
  }

  it('keeps the global list when the project has no override file', () => {
    const resolved = resolveWorkspaceMcpServers([globalDocs, globalGit], workspace())
    expect(resolved.error).toBeUndefined()
    expect(resolved.overrideIds).toEqual([])
    expect(resolved.servers.map((server) => server.id)).toEqual(['docs', 'git'])
    expect(resolved.servers.find((server) => server.id === 'docs')?.command).toBe('npx')
  })

  it('replaces a global server and can turn it off for this folder', () => {
    const dir = workspace()
    writeWorkspaceMcpOverride(dir, [
      { id: 'docs', enabled: false, transport: 'stdio', command: 'project-docs' },
      { id: 'local', enabled: true, transport: 'stdio', command: 'local-mcp' }
    ])

    const resolved = resolveWorkspaceMcpServers([globalDocs, globalGit], dir)
    expect(resolved.overrideIds).toEqual(['docs', 'local'])
    expect(resolved.servers.find((server) => server.id === 'docs')).toMatchObject({
      command: 'project-docs',
      enabled: false
    })
    expect(resolved.servers.find((server) => server.id === 'git')?.command).toBe('git-mcp')
    expect(resolved.servers.find((server) => server.id === 'local')?.command).toBe('local-mcp')
  })

  it('ignores a blank override file and reports broken JSON without dropping globals', () => {
    const blank = workspace()
    mkdirSync(join(blank, '.openrouter'))
    writeFileSync(join(blank, '.openrouter', 'mcp.json'), '   ')
    expect(resolveWorkspaceMcpServers([globalDocs], blank).servers).toHaveLength(1)

    const broken = workspace()
    mkdirSync(join(broken, '.openrouter'))
    writeFileSync(join(broken, '.openrouter', 'mcp.json'), '{')
    const resolved = resolveWorkspaceMcpServers([globalDocs], broken)
    expect(resolved.servers.map((server) => server.command)).toEqual(['npx'])
    expect(resolved.error).toBeTruthy()
    expect(resolved.overrideIds).toEqual([])
  })

  it('deletes the override file when the project list is cleared', () => {
    const dir = workspace()
    writeWorkspaceMcpOverride(dir, [globalDocs])
    writeWorkspaceMcpOverride(dir, [])
    expect(resolveWorkspaceMcpServers([globalGit], dir).overrideIds).toEqual([])
    expect(resolveWorkspaceMcpServers([globalGit], dir).servers[0]?.id).toBe('git')
  })

  it('reconnects a folder change on the merged set and waits while the agent is answering', async () => {
    const dir = workspace()
    writeWorkspaceMcpOverride(dir, [
      { id: 'docs', enabled: false, transport: 'stdio', command: 'project-docs' }
    ])
    const calls: string[] = []
    let seen = ''
    const manager = {
      queueReconnectAfterRun: () => calls.push('queue'),
      reconnectAll: async () => {
        const merged = resolveWorkspaceMcpServers([globalDocs, globalGit], dir)
        seen = merged.servers.map((server) => `${server.id}:${server.command}:${server.enabled}`).join(',')
        calls.push('reconnect')
      }
    }

    scheduleWorkspaceMcpReconnect(true, manager)
    expect(calls).toEqual(['queue'])
    expect(seen).toBe('')

    await scheduleWorkspaceMcpReconnect(false, manager)
    expect(calls).toEqual(['queue', 'reconnect'])
    expect(seen).toBe('docs:project-docs:false,git:git-mcp:true')
  })
})
