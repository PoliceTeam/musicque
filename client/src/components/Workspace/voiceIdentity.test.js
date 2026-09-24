import { describe, expect, it } from 'vitest'
import { speakerSocketIds } from './voiceIdentity'

describe('speakerSocketIds', () => {
  it('ghép danh tính LiveKit với socket nhân vật và loại bản ghi không hợp lệ', () => {
    expect(speakerSocketIds([
      { identity: 'user-a:socket-a' },
      { identity: 'user-b:socket-b' },
      { identity: 'user-a:socket-a' },
      { identity: 'invalid' },
    ])).toEqual(['socket-a', 'socket-b'])
  })
})
