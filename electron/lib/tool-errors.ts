export type ToolErrorKind =
  | 'validation'
  | 'not_found'
  | 'ambiguous'
  | 'blocked'
  | 'permission'
  | 'execution'
  | 'retry_exhausted'
  | 'unknown'

export interface StructuredToolError {
  kind: ToolErrorKind
  message: string
  hint?: string
  retryable: boolean
}

export function classifyToolErrorMessage(message: string): StructuredToolError {
  const lower = message.toLowerCase()

  if (lower.includes('old_string not found')) {
    return {
      kind: 'not_found',
      message,
      hint: 'Read the file with read_files first and copy the exact text including whitespace.',
      retryable: true
    }
  }
  if (lower.includes('matched') && lower.includes('times')) {
    return {
      kind: 'ambiguous',
      message,
      hint: 'Add more surrounding context to old_string or set replace_all: true.',
      retryable: true
    }
  }
  if (lower.includes('identical')) {
    return {
      kind: 'validation',
      message,
      hint: 'old_string and new_string must differ.',
      retryable: false
    }
  }
  if (lower.includes('blocked potentially destructive') || lower.includes('do not use the shell to search')) {
    return {
      kind: 'blocked',
      message,
      hint: 'Use grep_workspace or codebase_search instead of shell search commands.',
      retryable: false
    }
  }
  if (lower.includes('user rejected')) {
    return {
      kind: 'permission',
      message,
      hint: 'Ask the user before retrying this action.',
      retryable: false
    }
  }
  if (lower.includes('not available in')) {
    return {
      kind: 'blocked',
      message,
      hint: 'Switch mode or use a read-only alternative.',
      retryable: false
    }
  }
  if (lower.includes('invalid tool call') || lower.includes('must be')) {
    return {
      kind: 'validation',
      message,
      hint: 'Fix tool arguments before retrying.',
      retryable: true
    }
  }

  return {
    kind: 'execution',
    message,
    hint: 'Review the error and adjust your approach before retrying.',
    retryable: true
  }
}

export function formatStructuredToolError(error: StructuredToolError): string {
  const lines = [`Error [${error.kind}]: ${error.message}`]
  if (error.hint) lines.push(`Hint: ${error.hint}`)
  lines.push(`Retryable: ${error.retryable ? 'yes' : 'no'}`)
  return lines.join('\n')
}

export function formatToolErrorFromMessage(rawMessage: string): string {
  const message = rawMessage.startsWith('Error:') ? rawMessage.slice(6).trim() : rawMessage
  return formatStructuredToolError(classifyToolErrorMessage(message))
}

export function buildRetryExhaustedError(toolName: string, attempts: number): string {
  return formatStructuredToolError({
    kind: 'retry_exhausted',
    message: `Tool "${toolName}" failed ${attempts} times with the same arguments.`,
    hint: 'Change your approach — read files, search the codebase, or ask the user.',
    retryable: false
  })
}

export function toolRetryKey(toolName: string, argsRaw: string): string {
  return `${toolName}:${argsRaw}`
}
