import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { DANCE_BPM } from './layout.js'

// Nhân vật chú tiểu (mẫu dựng trong chibi.js): có xương nhưng không kèm animation, nên mọi tư thế
// được dựng bằng góc xoay xương. Góc khai báo theo trục thế giới khi nhân vật quay mặt +Z:
// pitch (+ = cúi về trước), yaw (quay quanh trục đứng), roll (nghiêng sang bên).

export const createLoader = () => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)

const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'upper_arm.L', 'forearm.L', 'hand.L', 'upper_arm.R', 'forearm.R', 'hand.R',
  'thigh.L', 'shin.L', 'foot.L', 'thigh.R', 'shin.R', 'foot.R']
const SIZE = 1 + BONES.length * 3
const SHADOW_LIFT = 0.03

const pose = (spec = {}) => {
  const out = new Float32Array(SIZE)
  out[0] = spec.y || 0
  BONES.forEach((name, i) => {
    const v = spec[name]
    if (v) out.set(v, 1 + i * 3)
  })
  return out
}
const mirror = (spec) => {
  const out = { ...spec }
  for (const [k, v] of Object.entries(spec)) {
    if (k.endsWith('.L')) out[k.replace('.L', '.R')] = [v[0], -v[1], -v[2]]
  }
  return out
}

const ARMS_DOWN = { 'upper_arm.L': [0, 0, 0.12], 'forearm.L': [-0.12, 0, 0] }
const STAND = pose(mirror({ ...ARMS_DOWN }))
// Chỉnh bằng đo: hai lòng bàn tay chạm nhau trước ngực, ngay ngoài mặt áo.
const GASSHO_ARMS = { neck: [0.12, 0, 0], head: [0.15, 0, 0], 'upper_arm.L': [-0.85, -0.8, 0.2], 'forearm.L': [-1.2, -0.6, 0], 'hand.L': [0.2, 0, 0] }
const GASSHO = pose(mirror(GASSHO_ARMS))
const KNEEL_LEGS = { y: -0.28, 'thigh.L': [-1.35, 0, 0.06], 'shin.L': [2.65, 0, 0], 'foot.L': [0.35, 0, 0] }
const KNEEL = pose(mirror({ ...KNEEL_LEGS, spine: [0.05, 0, 0], head: [0.1, 0, 0], 'upper_arm.L': [-0.35, -0.1, 0.12], 'forearm.L': [-0.9, -0.55, 0] }))
const KNEEL_GASSHO = pose(mirror({ ...KNEEL_LEGS, ...GASSHO_ARMS }))
const PROSTRATE = pose(mirror({
  y: -0.28, 'thigh.L': [-1.05, 0, 0.08], 'shin.L': [2.75, 0, 0], 'foot.L': [0.35, 0, 0],
  spine: [0.75, 0, 0], chest: [0.6, 0, 0], neck: [0.15, 0, 0], head: [0.1, 0, 0],
  'upper_arm.L': [-1.55, -0.1, 0.2], 'forearm.L': [-0.2, 0, 0], 'hand.L': [-0.5, 0, 0],
}))
// Hai tay gần nhau trước bụng như đang lần chuỗi hạt.
const BEADS_HANDS = { head: [0.3, 0, 0], neck: [0.08, 0, 0], 'upper_arm.L': [-0.7, -0.7, 0.15], 'forearm.L': [-0.9, -0.8, 0], 'upper_arm.R': [-0.65, 0.7, -0.15], 'forearm.R': [-0.7, 0.9, 0] }
const BEADS_STAND = pose({ ...BEADS_HANDS })
const BEADS_KNEEL = pose({ ...mirror(KNEEL_LEGS), ...BEADS_HANDS })

const smooth = (t) => t * t * (3 - 2 * t)
const mix = (out, a, b, t) => {
  for (let i = 0; i < SIZE; i++) out[i] = a[i] + (b[i] - a[i]) * t
  return out
}
// Nối nhiều khung (pose, mốc 0..1) theo pha chu kỳ.
const track = (out, frames, phase) => {
  for (let i = 0; i < frames.length - 1; i++) {
    const [a, ta] = frames[i]
    const [b, tb] = frames[i + 1]
    if (phase <= tb) return mix(out, a, b, smooth((phase - ta) / Math.max(1e-6, tb - ta)))
  }
  return out.set(frames[frames.length - 1][0]) || out
}
const STAND_BOW = [[STAND, 0], [GASSHO, 0.12], [KNEEL_GASSHO, 0.32], [PROSTRATE, 0.48], [PROSTRATE, 0.62], [KNEEL_GASSHO, 0.78], [GASSHO, 0.94], [STAND, 1]]
const KNEEL_BOW = [[KNEEL_GASSHO, 0], [PROSTRATE, 0.3], [PROSTRATE, 0.55], [KNEEL_GASSHO, 0.85], [KNEEL_GASSHO, 1]]
export const BOW_SECONDS = 5.2

const walkPose = (out, phase, amount) => {
  out.set(STAND)
  const s = Math.sin(phase)
  const c = Math.cos(phase)
  const set = (name, p, y = 0, r = 0) => {
    const i = 1 + BONES.indexOf(name) * 3
    out[i] += p * amount
    out[i + 1] += y * amount
    out[i + 2] += r * amount
  }
  set('thigh.L', -0.42 * s)
  set('thigh.R', 0.42 * s)
  set('shin.L', 0.5 * Math.max(0, -c))
  set('shin.R', 0.5 * Math.max(0, c))
  set('upper_arm.L', 0.28 * s)
  set('upper_arm.R', -0.28 * s)
  set('spine', 0.05, 0.06 * s)
  out[0] = -0.015 * amount * Math.abs(c)
  return out
}
const dancePose = (out, beat) => {
  out.set(STAND)
  const s = Math.sin(beat * Math.PI)
  const sway = Math.sin(beat * Math.PI * 0.5)
  const add = (name, p, y, r) => {
    const i = 1 + BONES.indexOf(name) * 3
    out[i] += p
    out[i + 1] += y
    out[i + 2] += r
  }
  out[0] = -0.05 * Math.abs(s)
  add('hips', 0, 0.25 * sway, 0.08 * sway)
  add('spine', 0.04, 0, -0.1 * sway)
  add('head', -0.05, -0.15 * sway, 0.12 * sway)
  add('upper_arm.L', -1.6 - 0.4 * sway, 0, 0.5 + 0.25 * s)
  add('upper_arm.R', -1.6 + 0.4 * sway, 0, -0.5 - 0.25 * s)
  add('forearm.L', -0.6, 0, 0.3 * s)
  add('forearm.R', -0.6, 0, -0.3 * s)
  add('thigh.L', -0.25 * Math.max(0, s), 0, 0)
  add('thigh.R', -0.25 * Math.max(0, -s), 0, 0)
  add('shin.L', 0.5 * Math.max(0, s), 0, 0)
  add('shin.R', 0.5 * Math.max(0, -s), 0, 0)
  return out
}

const shadowTexture = (() => {
  let tex = null
  return () => {
    if (tex) return tex
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(0,0,0,0.55)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    tex = new THREE.CanvasTexture(c)
    return tex
  }
})()
let shadowGeo = null
let shadowMat = null

const qa = new THREE.Quaternion()
const AXIS_ORDER = [1, 0, 2]

export class Monk {
  constructor(template, { shadows = false } = {}) {
    this.root = new THREE.Group()
    const body = cloneSkinned(template.scene)
    body.scale.setScalar(template.scale)
    body.position.y = -template.floor * template.scale
    body.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = shadows
        o.frustumCulled = false
      }
    })
    this.body = body
    this.root.add(body)
    if (!shadowGeo) {
      shadowGeo = new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2)
      shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false })
    }
    const blob = new THREE.Mesh(shadowGeo, shadowMat)
    blob.position.y = SHADOW_LIFT
    this.shadow = blob
    blob.renderOrder = -1
    this.root.add(blob)

    // Mô hình gốc quay mặt về -Z; xoay nửa vòng để root quay mặt +Z như mọi quy ước trong cảnh.
    body.rotation.y = Math.PI
    this.root.updateMatrixWorld(true)
    const found = {}
    // GLTFLoader bỏ dấu chấm khỏi tên node ("upper_arm.L" → "upper_armL").
    body.traverse((o) => { if (o.isBone && !found[o.name]) found[o.name] = o })
    this.bones = BONES.map((name) => {
      const bone = found[name] || found[name.replace(/\./g, '')]
      if (!bone) return null
      const inv = new THREE.Quaternion()
      bone.getWorldQuaternion(inv).invert()
      return {
        bone,
        rest: bone.quaternion.clone(),
        restY: bone.position.y,
        axes: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)].map((a) => a.applyQuaternion(inv).normalize()),
      }
    })
    this.hipsUnit = template.scale ? 1 / template.scale : 1
    this.current = new Float32Array(STAND)
    this.target = new Float32Array(SIZE)
    this.walkPhase = 0
    this.poseStart = 0
    this.lastPose = 'standing'
    this.hitbox = null
  }

  // Bóng bám sàn thật, không đi theo độ trễ lên/xuống của thân.
  setGroundHeight(height) {
    this.shadow.position.y = height + SHADOW_LIFT - this.root.position.y
  }

  // state: { pose, moving (0..1), dance, now }
  update(dt, { pose: name, moving = 0, dance = false, now }) {
    if (name !== this.lastPose) {
      this.lastPose = name
      this.poseStart = now
    }
    const t = this.target
    const elapsed = (now - this.poseStart) / 1000
    let snap = false
    if (name === 'bowing' && dance) {
      dancePose(t, (now / 1000) * (DANCE_BPM / 60))
      snap = true
    } else if (name === 'bowing' || name === 'bowing-kneel') {
      const phase = (elapsed / BOW_SECONDS) % 1
      track(t, name === 'bowing' ? STAND_BOW : KNEEL_BOW, phase)
      snap = elapsed > 0.4
    } else if (name === 'praying') t.set(GASSHO)
    else if (name === 'praying-kneel') t.set(KNEEL_GASSHO)
    else if (name === 'kneeling') t.set(KNEEL)
    else if (name === 'beads') t.set(BEADS_STAND)
    else if (name === 'beads-kneel') t.set(BEADS_KNEEL)
    else if (moving > 0.02) {
      this.walkPhase += dt * (4.2 + moving * 1.5)
      walkPose(t, this.walkPhase, Math.min(1, moving * 1.4))
      snap = true
    } else t.set(STAND)

    const k = snap ? 1 - Math.exp(-dt * 14) : 1 - Math.exp(-dt * 6)
    mix(this.current, this.current, t, k)
    this.apply(this.current)
  }

  apply(values) {
    for (let i = 0; i < this.bones.length; i++) {
      const b = this.bones[i]
      if (!b) continue
      const o = 1 + i * 3
      b.bone.quaternion.copy(b.rest)
      // Thứ tự: quay ngang (ngoài cùng) → cúi/ngửa → nghiêng, để "đưa tay vào giữa" xoay đúng hướng.
      for (const a of AXIS_ORDER) {
        const v = values[o + a]
        if (v) b.bone.quaternion.multiply(qa.setFromAxisAngle(b.axes[a], v))
      }
      if (i === 0) b.bone.position.y = b.restY + values[0] * this.hipsUnit
    }
  }

  dispose() {
    this.root.removeFromParent()
    this.body.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.dispose() })
  }
}
