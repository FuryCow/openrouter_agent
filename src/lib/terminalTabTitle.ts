const MAX_TITLE_LENGTH = 28

/** Strip ANSI/VT escapes from a typed command buffer. */
function stripAnsi(input: string): string {
  return input
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, '')
    .replace(/\x1B\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1B[@-Z\\-_]/g, '')
    .replace(/\x1B./g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

export function titleFromFirstCommand(input: string): string | null {
  const trimmed = stripAnsi(input).trim()
  if (!trimmed) return null
  if (trimmed.length <= MAX_TITLE_LENGTH) return trimmed
  return `${trimmed.slice(0, MAX_TITLE_LENGTH - 1)}…`
}

type InputParseState = 'normal' | 'escape' | 'csi' | 'osc'

export interface CommandInputTracker {
  buffer: string
  state: InputParseState
}

export function createCommandInputTracker(): CommandInputTracker {
  return { buffer: '', state: 'normal' }
}

function consumeEscapeSequence(char: string, state: InputParseState): InputParseState {
  if (state === 'escape') {
    if (char === '[') return 'csi'
    if (char === ']') return 'osc'
    return 'normal'
  }

  if (state === 'csi') {
    const code = char.charCodeAt(0)
    if (code >= 0x40 && code <= 0x7e) return 'normal'
    return 'csi'
  }

  if (state === 'osc') {
    if (char === '\x07') return 'normal'
    return 'osc'
  }

  return state
}

export function trackFirstCommandInput(
  data: string,
  tracker: CommandInputTracker,
  onCommand: (command: string) => void
): CommandInputTracker {
  let { buffer: next, state } = tracker

  for (const char of data) {
    const code = char.charCodeAt(0)

    if (state !== 'normal') {
      state = consumeEscapeSequence(char, state)
      continue
    }

    if (code === 27) {
      state = 'escape'
      continue
    }

    if (code === 13 || code === 10) {
      const command = stripAnsi(next).trim()
      if (command) {
        onCommand(command)
        return createCommandInputTracker()
      }
      next = ''
      continue
    }

    if (code === 127 || code === 8) {
      next = next.slice(0, -1)
      continue
    }

    if (code >= 32 && code !== 127) {
      next += char
    }
  }

  return { buffer: stripAnsi(next), state }
}
