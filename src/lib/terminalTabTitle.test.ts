import { describe, expect, it } from 'vitest'
import {
  titleFromFirstCommand,
  trackFirstCommandInput,
  createCommandInputTracker
} from './terminalTabTitle'

describe('terminalTabTitle', () => {
  it('builds a title from the first non-empty command', () => {
    expect(titleFromFirstCommand('  npm run dev  ')).toBe('npm run dev')
    expect(titleFromFirstCommand('')).toBeNull()
  })

  it('truncates long commands', () => {
    const long = 'a'.repeat(40)
    expect(titleFromFirstCommand(long)?.endsWith('…')).toBe(true)
  })

  it('captures the first submitted line from terminal input', () => {
    let captured = ''
    let tracker = createCommandInputTracker()
    tracker = trackFirstCommandInput('npm ', tracker, (command) => {
      captured = command
    })
    tracker = trackFirstCommandInput('run dev\r', tracker, (command) => {
      captured = command
    })
    expect(captured).toBe('npm run dev')
  })

  it('ignores ansi escape fragments from shell echo', () => {
    let captured = ''
    let tracker = createCommandInputTracker()
    tracker = trackFirstCommandInput('\x1b[0m', tracker, (command) => {
      captured = command
    })
    tracker = trackFirstCommandInput('ls\r', tracker, (command) => {
      captured = command
    })
    expect(captured).toBe('ls')
    expect(tracker.buffer).toBe('')
  })

  it('keeps escape parser state across chunks', () => {
    let captured = ''
    let tracker = createCommandInputTracker()
    tracker = trackFirstCommandInput('\x1b[0', tracker, (command) => {
      captured = command
    })
    tracker = trackFirstCommandInput('mls\r', tracker, (command) => {
      captured = command
    })
    expect(captured).toBe('ls')
  })
})
