export interface ResolveInChatPayload {
  filePath: string
  line: number
  column: number
  message: string
  lineText: string
}

export function buildResolveInChatPrompt(payload: ResolveInChatPayload): string {
  const location =
    payload.column > 0 ? `line ${payload.line}, column ${payload.column}` : `line ${payload.line}`

  return [
    `Fix this error in \`${payload.filePath}\` (${location}):`,
    '',
    '```',
    payload.lineText.trimEnd(),
    '```',
    '',
    `Error: ${payload.message}`
  ].join('\n')
}
