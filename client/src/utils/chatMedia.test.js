import { describe, expect, it } from 'vitest'
import { getPastedImageFile, insertAtCursor, resolveChatImageSrc } from './chatMedia'

describe('chatMedia', () => {
  it('prefixes relative chat image URLs with the API origin', () => {
    expect(resolveChatImageSrc('/api/chat/images/shot.png')).toMatch(/\/api\/chat\/images\/shot\.png$/)
    expect(resolveChatImageSrc('https://cdn.example/shot.png')).toBe('https://cdn.example/shot.png')
    expect(resolveChatImageSrc('')).toBe('')
  })

  it('inserts emoji at the cursor without exceeding the max length', () => {
    expect(insertAtCursor('hello', '👋', 5, 5)).toEqual({ value: 'hello👋', cursor: 7 })
    expect(insertAtCursor('hi there', '🔥', 3, 3)).toEqual({ value: 'hi 🔥there', cursor: 5 })
    expect(insertAtCursor('ab', '😄', 0, 0, 3)).toEqual({ value: 'ab', cursor: 0 })
  })

  it('reads a pasted image file from clipboard items', () => {
    const file = new File(['png'], 'shot.png', { type: 'image/png' })
    const clipboardData = {
      items: [
        { type: 'text/plain', getAsFile: () => null },
        { type: 'image/png', getAsFile: () => file },
      ],
    }

    expect(getPastedImageFile(clipboardData)).toBe(file)
    expect(getPastedImageFile({ files: [file] })).toBe(file)
    expect(getPastedImageFile({ items: [] })).toBeNull()
  })
})
