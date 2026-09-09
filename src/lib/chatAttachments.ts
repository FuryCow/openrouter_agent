import { truncateFileContent } from '@/lib/agentContext'

export const CHAT_ATTACHMENT_MAX_COUNT = 8
export const CHAT_ATTACHMENT_MAX_BYTES = 512_000

const TEXT_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'md',
  'txt',
  'yaml',
  'yml',
  'toml',
  'css',
  'scss',
  'html',
  'htm',
  'xml',
  'svg',
  'env',
  'csv',
  'log',
  'py',
  'rs',
  'go',
  'java',
  'kt',
  'cpp',
  'c',
  'h',
  'hpp',
  'sh',
  'ps1',
  'sql',
  'graphql',
  'vue',
  'svelte'
])

export interface ChatImageAttachment {
  kind: 'image'
  id: string
  name: string
  dataUrl: string
}

export interface ChatFileAttachmentItem {
  kind: 'file'
  id: string
  name: string
  content: string
  truncated: boolean
}

export type ChatInputAttachment = ChatImageAttachment | ChatFileAttachmentItem

function makeAttachmentId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

export function isTextLikeFile(file: File): boolean {
  if (isImageFile(file)) return false

  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension && TEXT_EXTENSIONS.has(extension)) return true

  if (!file.type) return true
  if (file.type.startsWith('text/')) return true

  return (
    file.type === 'application/json' ||
    file.type === 'application/xml' ||
    file.type === 'application/javascript' ||
    file.type === 'application/typescript'
  )
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('read_failed'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('read_failed'))
    reader.readAsDataURL(file)
  })
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('read_failed'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('read_failed'))
    reader.readAsText(file)
  })
}

export async function readChatAttachment(file: File): Promise<ChatInputAttachment> {
  if (isImageFile(file)) {
    return {
      kind: 'image',
      id: makeAttachmentId(),
      name: file.name,
      dataUrl: await readAsDataUrl(file)
    }
  }

  if (!isTextLikeFile(file)) {
    throw new Error('unsupported')
  }

  if (file.size > CHAT_ATTACHMENT_MAX_BYTES) {
    throw new Error('too_large')
  }

  const raw = await readAsText(file)
  const { content, truncated } = truncateFileContent(raw)

  return {
    kind: 'file',
    id: makeAttachmentId(),
    name: file.name,
    content,
    truncated
  }
}

export function splitChatAttachments(attachments: ChatInputAttachment[]): {
  images?: string[]
  attachedFiles?: Array<{ name: string; content: string; truncated?: boolean }>
} {
  const images = attachments
    .filter((item): item is ChatImageAttachment => item.kind === 'image')
    .map((item) => item.dataUrl)
  const attachedFiles = attachments
    .filter((item): item is ChatFileAttachmentItem => item.kind === 'file')
    .map(({ name, content, truncated }) => ({ name, content, truncated }))

  return {
    images: images.length > 0 ? images : undefined,
    attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined
  }
}
