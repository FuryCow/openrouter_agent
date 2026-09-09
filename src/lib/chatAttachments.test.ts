import { describe, expect, it } from 'vitest'
import { isTextLikeFile, splitChatAttachments } from './chatAttachments'

describe('chatAttachments', () => {
  it('detects text-like files by extension', () => {
    expect(isTextLikeFile(new File(['a'], 'app.ts', { type: 'text/plain' }))).toBe(true)
    expect(isTextLikeFile(new File(['a'], 'photo.jpg', { type: 'image/jpeg' }))).toBe(false)
    expect(isTextLikeFile(new File(['a'], 'archive.zip', { type: 'application/zip' }))).toBe(false)
  })

  it('splits image and file attachments for send payload', () => {
    const payload = splitChatAttachments([
      {
        kind: 'image',
        id: '1',
        name: 'shot.png',
        dataUrl: 'data:image/png;base64,abc'
      },
      {
        kind: 'file',
        id: '2',
        name: 'main.ts',
        content: 'export {}',
        truncated: false
      }
    ])

    expect(payload.images).toEqual(['data:image/png;base64,abc'])
    expect(payload.attachedFiles).toEqual([
      { name: 'main.ts', content: 'export {}', truncated: false }
    ])
  })
})
