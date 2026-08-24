import { describe, expect, it } from 'vitest'
import { restoreStickyPosition, snapStickyPosition } from './xiangqiSticky'

const viewport = { width: 238, height: 92, viewportWidth: 1280, viewportHeight: 720, bottomInset: 12 }

describe('snapStickyPosition', () => {
  it('hít vào cạnh trái gần nhất', () => {
    expect(snapStickyPosition({ ...viewport, x: 20, y: 240 })).toEqual({ edge: 'left', x: 12, y: 240 })
  })

  it('hít vào cạnh phải gần nhất', () => {
    expect(snapStickyPosition({ ...viewport, x: 1025, y: 240 })).toEqual({ edge: 'right', x: 1030, y: 240 })
  })

  it('hít vào cạnh dưới và chừa khoảng cho player', () => {
    const result = snapStickyPosition({ ...viewport, x: 500, y: 600, bottomInset: 96 })
    expect(result).toEqual({ edge: 'bottom', x: 500, y: 532 })
  })
})

describe('restoreStickyPosition', () => {
  it('giữ card trong viewport khi kích thước cửa sổ thay đổi', () => {
    const restored = restoreStickyPosition({ edge: 'right', x: 1200, y: 900 }, viewport)
    expect(restored).toEqual({ edge: 'right', x: 1030, y: 616 })
  })
})
