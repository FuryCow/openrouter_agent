import { describe, expect, it } from 'vitest'
import { TerminalService } from './terminal'

describe('TerminalService', () => {
  it('creates and destroys a session', () => {
    const service = new TerminalService()
    const id = service.create()
    expect(id).toMatch(/^term-/)
    service.destroy(id)
  })

  it('rejects new sessions after destroyAll', () => {
    const service = new TerminalService()
    const id = service.create()
    service.destroyAll()
    expect(() => service.create()).toThrow(/shutting down/i)
    service.destroy(id)
  })
})
