import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { Monk } from './monk'

let monk
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    createRadialGradient: () => ({ addColorStop() {} }), fillRect() {},
  })
  monk = new Monk({ scene: new THREE.Group(), scale: 1, floor: 0 })
})
afterEach(() => { monk.dispose(); vi.restoreAllMocks() })

const shadowHeight = () => {
  monk.root.updateMatrixWorld(true)
  const shadow = monk.root.children.find((o) => o.isMesh && o.material.transparent)
  return shadow.getWorldPosition(new THREE.Vector3()).y
}

it('bóng tiếp xúc không trùng mặt đường 0.012 hay sân trăng 0.015', () => {
  expect(shadowHeight()).toBeGreaterThan(0.015)
})

it('bóng bám mặt sàn khi thân nhân vật đang đổi độ cao có độ trễ', () => {
  for (const floor of [0, 0.45, 0.57]) {
    const heights = [floor - 0.2, floor - 0.05, floor].map((bodyY) => {
      monk.root.position.y = bodyY
      monk.setGroundHeight(floor)
      return shadowHeight()
    })
    expect(heights[0]).toBeGreaterThan(floor + 0.015)
    expect(heights[1]).toBeCloseTo(heights[0], 8)
    expect(heights[2]).toBeCloseTo(heights[0], 8)
  }
})
