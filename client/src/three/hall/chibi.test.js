import { afterAll, expect, test, vi } from 'vitest'
import * as THREE from 'three'
import { createChibiTemplate } from './chibi.js'
import { Monk, BOW_SECONDS } from './monk.js'

const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ctx), set: () => true })
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
afterAll(() => vi.restoreAllMocks())
const template = createChibiTemplate()

test('chú tiểu là một mesh một vật liệu, dưới ngân sách tam giác', () => {
  const meshes = []
  template.scene.traverse((o) => { if (o.isMesh) meshes.push(o) })
  expect(meshes).toHaveLength(1)
  expect(meshes[0].geometry.index.count / 3).toBeLessThan(6000)
})

test('không phần nào của chú tiểu lún xuống sàn khi lạy, đi, nhảy', () => {
  const monk = new Monk(template)
  let mesh
  monk.body.traverse((o) => { if (o.isSkinnedMesh) mesh = o })
  const pos = mesh.geometry.attributes.position
  const v = new THREE.Vector3()
  const lowest = () => {
    monk.root.updateMatrixWorld(true)
    let min = Infinity
    for (let i = 0; i < pos.count; i++) min = Math.min(min, mesh.applyBoneTransform(i, v.fromBufferAttribute(pos, i)).applyMatrix4(mesh.matrixWorld).y)
    return min
  }
  const states = [
    ...['bowing', 'bowing-kneel'].flatMap((pose) => Array.from({ length: 25 }, (_, i) => ({ pose, now: (i / 25) * BOW_SECONDS * 1000 }))),
    ...Array.from({ length: 8 }, (_, i) => ({ pose: 'standing', moving: 1, now: i * 90 })),
    ...Array.from({ length: 8 }, (_, i) => ({ pose: 'bowing', dance: true, now: i * 130 })),
    ...['standing', 'kneeling', 'praying-kneel', 'beads', 'beads-kneel'].map((pose) => ({ pose, now: 0 })),
  ]
  for (const s of states) {
    monk.lastPose = s.pose
    monk.poseStart = 0
    for (let k = 0; k < 40; k++) monk.update(0.1, s)
    expect(lowest(), JSON.stringify(s)).toBeGreaterThan(-0.004)
  }
  monk.dispose()
})
