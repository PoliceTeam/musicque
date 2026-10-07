import { describe, expect, it } from 'vitest'
import {
  capturedPieces,
  clockRemaining,
  deriveMoveEvent,
  describeResult,
  formatClock,
  isWater,
  jumpArc,
  looksLikeMove,
  squareToWorld,
  worldToSquare,
} from './jungle'

describe('bản đồ bàn cờ', () => {
  it('ô ↔ toạ độ 3D đi hai chiều, tâm bàn ở d5', () => {
    expect(squareToWorld('d5')).toEqual([0, 0, 0])
    expect(squareToWorld('a1')).toEqual([-3, 0, 4])
    expect(squareToWorld('g9')).toEqual([3, 0, -4])
    for (const square of ['a1', 'c4', 'g9', 'e7']) {
      const [x, , z] = squareToWorld(square)
      expect(worldToSquare(x + 0.3, z - 0.3)).toBe(square)
    }
    expect(worldToSquare(5, 0)).toBeNull()
  })

  it('12 ô sông đúng vị trí', () => {
    expect(isWater('b4') && isWater('f6') && isWater('c5')).toBe(true)
    expect(isWater('d5') || isWater('a4') || isWater('b3')).toBe(false)
  })
})

describe('looksLikeMove', () => {
  it('nhận nước 1 ô và nước nhảy qua sông', () => {
    expect(looksLikeMove('d5', 'd6')).toBe(true)
    expect(looksLikeMove('b3', 'b7')).toBe(true)
    expect(looksLikeMove('a4', 'd4')).toBe(true)
    expect(looksLikeMove('d5', 'e6')).toBe(false)
    expect(looksLikeMove('d3', 'd7')).toBe(false)
  })
})

describe('đồng hồ', () => {
  it('chỉ trừ thời gian của bên đang chạy', () => {
    const clock = { red: 60_000, blue: 30_000, running: 'red' }
    expect(clockRemaining(clock, 'red', 1000, 4000)).toBe(57_000)
    expect(clockRemaining(clock, 'blue', 1000, 4000)).toBe(30_000)
    expect(clockRemaining(null, 'red', 0, 0)).toBeNull()
  })

  it('định dạng mm:ss, làm tròn lên', () => {
    expect(formatClock(900_000)).toBe('15:00')
    expect(formatClock(61_200)).toBe('1:02')
    expect(formatClock(null)).toBe('∞')
  })
})

describe('deriveMoveEvent', () => {
  const state = (ply, lastMove) => ({ board: { ply, lastMove } })

  it('dựng sự kiện cho đúng nước kế tiếp, kể cả Chuột ăn Voi', () => {
    const event = deriveMoveEvent(state(4, null), state(5, { side: 'red', piece: 'rat', from: 'd4', to: 'd5', jump: false, captured: 'elephant' }))
    expect(event).toMatchObject({ id: 'red-rat', captured: { id: 'blue-elephant' }, ratEatsElephant: true })
  })

  it('bỏ qua khi nhảy cóc nhiều ply hoặc chưa có state trước', () => {
    expect(deriveMoveEvent(state(4, null), state(6, { side: 'red', piece: 'cat', from: 'a1', to: 'a2' }))).toBeNull()
    expect(deriveMoveEvent(null, state(1, { side: 'red', piece: 'cat', from: 'a1', to: 'a2' }))).toBeNull()
  })
})

describe('kết quả và quân bị ăn', () => {
  it('đọc kết quả theo góc nhìn người chơi', () => {
    expect(describeResult({ winner: 'red', reason: 'den' }, 'red').tone).toBe('win')
    expect(describeResult({ winner: 'red', reason: 'timeout' }, 'blue')).toMatchObject({ tone: 'lose', detail: 'bạn hết giờ' })
    expect(describeResult({ winner: null, reason: 'repetition' }, 'red').tone).toBe('draw')
    expect(describeResult({ winner: 'blue', reason: 'den' }, null).title).toBe('Phe Xanh thắng')
  })

  it('liệt kê quân đã mất của mỗi phe', () => {
    const pieces = [{ side: 'red', type: 'rat' }, { side: 'blue', type: 'lion' }]
    const captured = capturedPieces(pieces)
    expect(captured.red).toHaveLength(7)
    expect(captured.red).not.toContain('rat')
    expect(captured.blue).toContain('elephant')
  })

  it('đường nhảy cao nhất ở giữa và về đúng ô đáp', () => {
    const from = [0, 0, 2]
    const to = [0, 0, -2]
    expect(jumpArc(from, to, 0.5)[1]).toBeCloseTo(1.6)
    expect(jumpArc(from, to, 1)).toEqual([0, 0, -2])
  })
})
