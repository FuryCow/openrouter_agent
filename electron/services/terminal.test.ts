import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockKill = vi.fn()

vi.mock('node-pty', () => ({
  spawn: vi.fn(() => ({
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: mockKill
  }))
}))

import { TerminalService } from './terminal'

describe('TerminalService', () => {
  beforeEach(() => {
    mockKill.mockClear()
  })

  it('creates and destroys a session', () => {
    const service = new TerminalService()
    const id = service.create()
    expect(id).toMatch(/^term-/)
    service.destroy(id)
    expect(mockKill).toHaveBeenCalledOnce()
  })

  it('rejects new sessions after destroyAll', () => {
    const service = new TerminalService()
    service.create()
    service.destroyAll()
    expect(() => service.create()).toThrow(/shutting down/i)
  })
})
