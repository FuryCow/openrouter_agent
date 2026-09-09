import type { ChatFileAttachment } from '../types'

export function buildUserMessageWithAttachments(
  userMessage: string,
  attachedFiles?: ChatFileAttachment[]
): string {
  if (!attachedFiles?.length) return userMessage

  const blocks = attachedFiles
    .map((file) => {
      const truncatedNote = file.truncated ? '\n<!-- truncated -->' : ''
      return `<attached_file name="${file.name}">\n${file.content}\n</attached_file>${truncatedNote}`
    })
    .join('\n\n')

  const names = attachedFiles.map((file) => file.name).join(', ')
  const preamble =
    `The user attached ${attachedFiles.length} file(s): ${names}. ` +
    'When they refer to "the attached file" or similar, answer from the `<attached_file>` blocks below only. ' +
    'Do not substitute open editor tabs or files mentioned earlier in the chat unless the user names them explicitly. ' +
    'The attachment content is already included — do not call read_files for these paths unless marked truncated.\n\n'

  const body = userMessage.trim()
  return body ? `${preamble}${blocks}\n\n${body}` : `${preamble}${blocks}`
}

export function formatAttachedFilesForSystemPrompt(
  attachedFiles?: ChatFileAttachment[]
): string {
  if (!attachedFiles?.length) return ''

  const list = attachedFiles
    .map((file) => `- ${file.name}${file.truncated ? ' (truncated in message)' : ''}`)
    .join('\n')

  return `User attachments in this turn (full content is in the next user message):
${list}
Treat attachment content as authoritative for this request.`
}
