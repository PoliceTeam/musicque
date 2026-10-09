import { readFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { Group, Quaternion, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { createCardPlayer, PLAYER_MODEL_URL, updatePlayerGrip } from './cardPlayer'
import { MOTION } from './anim'

const bytes = readFileSync('public/models/chibi-card-player.glb')
const size = bytes.readUInt32LE(12), json = JSON.parse(bytes.toString('utf8', 20, 20 + size))
async function loadPlayer() {
  const model = structuredClone(json)
  // Test rig trong Node/jsdom, không cần GPU để giải mã texture.
  for (const material of model.materials) {
    delete material.pbrMetallicRoughness?.baseColorTexture
    delete material.normalTexture; delete material.emissiveTexture; delete material.occlusionTexture
  }
  const payload = Buffer.from(JSON.stringify(model)), padded = Buffer.concat([payload, Buffer.alloc((4 - payload.length % 4) % 4, 32)])
  const header = Buffer.alloc(20)
  header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(bytes.length - size + padded.length, 8); header.writeUInt32LE(padded.length, 12); header.write('JSON', 16)
  const buffer = Buffer.concat([header, padded, bytes.subarray(20 + size)])
  const data = new ArrayBuffer(buffer.length)
  new Uint8Array(data).set(buffer)
  return new GLTFLoader().parseAsync(data, '')
}

describe('asset riêng cho người chơi bài', () => {
  it('giữ đúng ngân sách và chỉ có bốn animation game', () => {
    expect(PLAYER_MODEL_URL).toContain('chibi-card-player.glb')
    expect(bytes.length).toBeLessThan(1_500_000)
    expect(json.meshes.reduce((sum, mesh) => sum + mesh.primitives.length, 0)).toBeLessThanOrEqual(6)
    const triangles = json.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((count, p) => count + json.accessors[p.indices].count / 3, 0), 0)
    expect(triangles).toBeLessThanOrEqual(12_000)
    expect(json.animations.map(clip => clip.name).sort()).toEqual(['CardHold', 'CardPickup', 'CardPlay', 'CardWait'])
  })
  it('giữ xấp bài bên trái và đưa tay phải ra đúng thời điểm thả', async () => {
    const { scene, animations } = await loadPlayer()
    const player = createCardPlayer(scene, animations)
    expect(player.duration).toBeCloseTo(MOTION.release + 300)
    scene.updateMatrixWorld(true)
    const left = player.grips.Left.hand.getWorldPosition(new Vector3())
    const right = player.grips.Right.hand.getWorldPosition(new Vector3())
    expect(right.distanceTo(left)).toBeGreaterThan(0.18)
    const wrist = player.grips.Right.hand.getWorldQuaternion(new Quaternion()).normalize()
    player.sample('CardPlay', MOTION.pick / 1000); scene.updateMatrixWorld(true)
    const picked = player.grips.Right.hand.getWorldPosition(new Vector3())
    expect(picked.distanceTo(left)).toBeLessThan(0.15)
    player.sample('CardPlay', MOTION.release / 1000); scene.updateMatrixWorld(true)
    expect(player.grips.Left.hand.getWorldPosition(new Vector3()).distanceTo(left)).toBeLessThan(0.02)
    expect(player.grips.Right.hand.getWorldPosition(new Vector3()).z).toBeGreaterThan(picked.z + 0.1)
    player.sample('CardPlay', player.duration / 1000); scene.updateMatrixWorld(true)
    expect(player.grips.Right.hand.getWorldPosition(new Vector3()).distanceTo(right)).toBeLessThan(1e-5)
    expect(player.grips.Right.hand.getWorldQuaternion(new Quaternion()).normalize().angleTo(wrist)).toBeLessThan(1e-5)
    player.dispose()
  })
  it('căn grip theo pose và giữ world transform khi nhân vật đổi ghế', async () => {
    const { scene, animations } = await loadPlayer()
    const player = createCardPlayer(scene, animations), anchor = new Group()
    updatePlayerGrip(player.grips.Left, anchor)
    expect(anchor.quaternion.angleTo(new Quaternion())).toBeLessThan(1e-6)
    const wrist = player.grips.Left.hand.getWorldPosition(new Vector3())
    expect(anchor.position.y - wrist.y).toBeCloseTo(0.035)
    expect(anchor.position.z - wrist.z).toBeCloseTo(0.025)
    player.sample('CardPlay', MOTION.pick / 1000); scene.updateMatrixWorld(true)
    const playing = new Group()
    updatePlayerGrip(player.grips.Right, playing)
    expect(playing.quaternion.angleTo(new Quaternion())).toBeLessThan(1e-6)
    player.sample('CardHold'); scene.updateMatrixWorld(true)
    const initial = anchor.position.clone(), parent = new Group()
    parent.position.set(0.95, 0.1, 0); parent.rotation.y = -Math.PI / 2; parent.scale.setScalar(0.85); parent.add(scene)
    updatePlayerGrip(player.grips.Left, anchor)
    expect(anchor.position.distanceTo(parent.localToWorld(initial))).toBeLessThan(1e-6)
    expect(anchor.quaternion.angleTo(parent.quaternion)).toBeLessThan(1e-6)
    player.dispose()
  })
  it('clone animation độc lập giữa các ghế và chốt pose nghỉ khi dừng', async () => {
    const { scene, animations } = await loadPlayer()
    const other = clone(scene), first = createCardPlayer(scene, animations), second = createCardPlayer(other, animations)
    const initial = second.grips.Right.hand.quaternion.clone()
    first.sample('CardPlay', 0.45)
    expect(second.grips.Right.hand.quaternion.angleTo(initial)).toBeLessThan(1e-6)
    first.sample('CardWait'); scene.updateMatrixWorld(true)
    const waiting = first.grips.Right.hand.getWorldPosition(new Vector3())
    first.sample('CardHold'); scene.updateMatrixWorld(true)
    expect(first.grips.Right.hand.getWorldPosition(new Vector3()).y).toBeGreaterThan(waiting.y + 0.08)
    first.dispose(); second.dispose()
  })
  it('báo lỗi asset thiếu clip để ErrorBoundary hiển thị fallback', () => {
    expect(() => createCardPlayer(new Group(), [])).toThrow('thiếu animation')
  })
})
