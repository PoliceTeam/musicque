import * as THREE from 'three'
import { buildWorld } from './world.js'
import { Monk } from './monk.js'
import { createPingLayer } from './pings.js'
import { createChibiTemplate } from './chibi.js'
import {
  CUSHIONS, DEFAULT_INCENSE, DEFAULT_PING, INCENSE_RANGE, WALK_SPEED, angleLerp, buildColliders, clampOrbit,
  allowPing, groundHeight, resolveCollisions, routeTo, sectorFor, zoneAt,
} from './layout.js'

const SEND_MS = 110
const DRAG_PX = 8
const SPAWN_PER_FRAME = 3
const MAX_STEP = 0.24
const VIEW_RANGE = 30
const _frustum = new THREE.Frustum()
const _m4 = new THREE.Matrix4()
const _sphere = new THREE.Sphere(new THREE.Vector3(), 0.8)
const CUSHION_TOP = 0.12 // độ dày nệm: quỳ trên nệm chứ không lún vào
const INTERP_MS = 150 // người khác được vẽ trễ 150ms để luôn có hai mốc server mà nội suy
const PIXEL_RATIO_MAX = 1.5
const PIXEL_RATIO_MIN = 0.9
const _target = new THREE.Vector3()
const _ndc = new THREE.Vector2()
const _dir = new THREE.Vector3()
const _look = new THREE.Vector3()
const _label = new THREE.Vector3()
// Hướng nắng cố định; dùng để khoá bóng đổ theo lưới texel (bóng không rung khi nhân vật đi).
const SUN_OFFSET = new THREE.Vector3(6, 18, 8)
const SUN_FWD = SUN_OFFSET.clone().negate().normalize()
const SUN_RIGHT = new THREE.Vector3().crossVectors(SUN_FWD, new THREE.Vector3(0, 1, 0)).normalize()
const SUN_UP = new THREE.Vector3().crossVectors(SUN_RIGHT, SUN_FWD)
const SHADOW_TEXEL = 28 / 2048

// Bộ điều khiển cảnh: render, camera quỹ đạo, nhân vật của mình, người khác và nhãn tên.
// Không biết gì về React; trao đổi với trang qua `net` (socket hoặc chế độ thử) và `onUi`.
export class HallEngine {
  constructor({ canvas, labels, net, onUi = () => {}, onProgress = () => {}, onPing = () => {}, onPingWheel = () => {}, onNotice = () => {} }) {
    this.canvas = canvas
    this.labelsEl = labels
    this.net = net
    this.onUi = onUi
    this.onProgress = onProgress
    this.onPing = onPing
    this.onPingWheel = onPingWheel
    this.onNotice = onNotice
    this.pingTimes = []
    this.orbit = { yaw: 0, pitch: 0.16, dist: 5.2 } // đích của thao tác chuột
    this.zoomDirection = 0
    this.view = { ...this.orbit } // giá trị đang hiển thị, đuổi theo orbit cho mượt
    this.frameNo = 0
    this.slowTime = 0
    this.fastTime = 0
    this.keys = new Set()
    this.remotes = new Map()
    this.pendingRemotes = new Map()
    this.state = null
    this.incense = DEFAULT_INCENSE
    this.colliders = buildColliders(this.incense)
    this.player = { x: 0, z: 10.6, y: 0, rot: Math.PI, vx: 0, vz: 0, pose: 'standing', base: 'standing', route: [], seatOnArrive: false, prayUntil: 0 }
    this.server = { cushionId: null, waiting: false, beads: 0, name: '', x: 0, z: 10 }
    this.sent = { x: 0, z: 10, rot: Math.PI, at: 0 }
    this.lastManual = -Infinity
    this.handledCushion = undefined
    this.ui = {}
    this.disposed = false
  }

  async init() {
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: import.meta.env.DEV })
    this.pixelRatio = Math.min(window.devicePixelRatio, PIXEL_RATIO_MAX)
    renderer.setPixelRatio(this.pixelRatio)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    this.renderer = renderer
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.15, 140)
    const world = await buildWorld(renderer, { incense: this.incense, onProgress: (p) => this.onProgress(p * 0.8) })
    if (this.disposed) return
    // Chú tiểu dựng bằng code (chibi.js): một mẫu dùng chung cho mình và mọi người khác.
    const hero = createChibiTemplate()
    this.world = world
    this.templates = { hero, lod: hero }
    this.scene = world.scene
    this.me = new Monk(hero, { shadows: true })
    this.scene.add(this.me.root)
    this.selfLabel = this.makeLabel('is-self')
    this.pingLayer = createPingLayer(this.scene, this.labelsEl)
    this.warmUp()
    this.raycaster = new THREE.Raycaster()
    this.resize()
    this.bind()
    this.onProgress(1)
    this.clock = new THREE.Clock()
    this.zoneTimer = 0
    renderer.setAnimationLoop(() => this.frame())
    this.unsub = this.net.onState((s) => this.applyState(s))
    // Ping của người khác (server chuyển tiếp hall:ping); ping của mình đã hiện ngay lúc bấm.
    this.unsubPing = this.net.on?.('hall:ping', (p) => {
      if (!p || p.by === this.net.selfId || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return
      const name = p.name || [...this.remotes.entries()].find(([id]) => id === p.by)?.[1].person?.name
      this.showPing({ kind: p.kind, x: p.x, z: p.z, name, mine: false })
    })
    if (import.meta.env.DEV) window.__hall = this
  }

  // Biên dịch mọi shader và đẩy mọi texture lên GPU ngay lúc tải, thay vì lúc một khu/nhân vật
  // lần đầu lọt vào khung nhìn (đó là các cú khựng 50–90ms khi đi xa).
  warmUp() {
    const probe = new Monk(this.templates.lod)
    probe.root.position.set(0, -50, 0)
    this.scene.add(probe.root)
    this.pingLayer.click(0, -50, 0)
    this.pingLayer.add({ kind: 'look', x: 0, y: -50, z: 0, mine: true })
    Object.values(this.world.zones).forEach((g) => { g.visible = true })
    this.renderer.compile(this.scene, this.camera)
    // Vẽ thử một khung với mọi vật thể (kể cả ngoài khung nhìn): GPU nhận hết hình khối và
    // shader bóng đổ ngay lúc tải, không phải lúc cây/khu mới lần đầu lọt vào màn hình.
    const culled = []
    this.scene.traverse((o) => {
      if (o.isMesh && o.frustumCulled) {
        culled.push(o)
        o.frustumCulled = false
      }
    })
    this.resize()
    this.renderer.render(this.scene, this.camera)
    culled.forEach((o) => { o.frustumCulled = true })
    this.scene.traverse((o) => {
      for (const m of [].concat(o.material || [])) {
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap']) if (m[key]) this.renderer.initTexture(m[key])
      }
    })
    probe.dispose()
    this.pingLayer.update(Infinity, () => {})
  }

  // ---------- Input ----------
  bind() {
    const c = this.canvas
    const pointers = new Map()
    let drag = null
    let pinch = 0
    let ping = null
    const down = (e) => {
      // Ctrl/Alt + bấm: ping. Kéo khi đang giữ thì mở vòng chọn loại ping.
      if ((e.ctrlKey || e.altKey) && (e.button === 0 || e.button === 2) && pointers.size === 0) {
        const point = this.groundAt(e.clientX, e.clientY)
        if (!point) return
        c.setPointerCapture(e.pointerId)
        const rect = c.getBoundingClientRect()
        ping = { id: e.pointerId, sx: e.clientX, sy: e.clientY, point, sector: null, left: e.clientX - rect.left, top: e.clientY - rect.top }
        this.onPingWheel({ x: ping.left, y: ping.top, sector: null, open: false })
        return
      }
      c.setPointerCapture(e.pointerId)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      drag = { x: e.clientX, y: e.clientY, rotating: false }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinch = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const move = (e) => {
      if (ping && e.pointerId === ping.id) {
        const dx = e.clientX - ping.sx
        const dy = e.clientY - ping.sy
        const sector = sectorFor(dx, dy)
        const open = ping.open || Math.hypot(dx, dy) > 8
        if (sector !== ping.sector || open !== ping.open) {
          ping.sector = sector
          ping.open = open
          this.onPingWheel({ x: ping.left, y: ping.top, sector, open })
        }
        return
      }
      if (!pointers.has(e.pointerId) || !drag) return
      const prev = pointers.get(e.pointerId)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch > 0 && d > 0) this.zoom(Math.log(pinch / d))
        pinch = d
        drag.rotating = true // đang chụm hai ngón thì không tính là bấm
        return
      }
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      // Tay rung lúc bấm không được tính là kéo: chỉ xoay khi đã rời điểm bấm quá DRAG_PX.
      if (!drag.rotating) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < DRAG_PX) return
        drag.rotating = true
        return
      }
      this.orbit.yaw -= dx * 0.005
      this.orbit.pitch += dy * 0.004
      Object.assign(this.orbit, clampOrbit(this.orbit))
    }
    const up = (e) => {
      if (ping && e.pointerId === ping.id) {
        // Mở vòng nhưng thả ở giữa thì huỷ; bấm nhanh không kéo thì ping mặc định.
        const kind = ping.sector || (ping.open ? null : DEFAULT_PING)
        if (kind && e.type === 'pointerup') this.ping(kind, ping.point)
        ping = null
        this.onPingWheel(null)
        return
      }
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinch = 0
      if (drag && !drag.rotating && pointers.size === 0) this.click(e)
      if (!pointers.size) drag = null
    }
    const wheel = (e) => {
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? (c.clientHeight || window.innerHeight) : 1
      const pixels = Math.max(-120, Math.min(120, e.deltaY * unit))
      this.zoom(pixels * (e.ctrlKey ? 0.006 : 0.0015))
    }
    const key = (e, isDown) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable="true"]')) return
      const k = e.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        if (isDown) {
          this.keys.add(k)
          e.preventDefault()
        } else this.keys.delete(k)
      }
    }
    const kd = (e) => key(e, true)
    const ku = (e) => key(e, false)
    const blur = () => this.keys.clear()
    const resize = () => this.resize()
    // macOS biến Ctrl+bấm thành chuột phải; chặn menu ngữ cảnh trên khung 3D.
    const menu = (e) => e.preventDefault()
    c.addEventListener('contextmenu', menu)
    c.addEventListener('pointerdown', down)
    c.addEventListener('pointermove', move)
    c.addEventListener('pointerup', up)
    c.addEventListener('pointercancel', up)
    c.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    window.addEventListener('blur', blur)
    window.addEventListener('resize', resize)
    this.unbind = () => {
      c.removeEventListener('contextmenu', menu)
      c.removeEventListener('pointerdown', down)
      c.removeEventListener('pointermove', move)
      c.removeEventListener('pointerup', up)
      c.removeEventListener('pointercancel', up)
      c.removeEventListener('wheel', wheel)
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      window.removeEventListener('blur', blur)
      window.removeEventListener('resize', resize)
    }
  }

  zoom(delta) {
    if (!Number.isFinite(delta) || delta === 0) return
    const direction = Math.sign(delta)
    if (this.zoomDirection && direction !== this.zoomDirection) this.orbit.dist = this.view.dist
    this.zoomDirection = direction
    this.orbit.dist *= Math.exp(Math.max(-0.22, Math.min(0.22, delta)))
    Object.assign(this.orbit, clampOrbit(this.orbit))
  }

  click(e) {
    const rect = this.canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    const ray = this.raycaster.ray
    // Bấm trúng người khác thì không đặt đích đi xuyên qua họ.
    let best = null
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    for (const r of this.remotes.values()) {
      if (!r.monk.root.visible) continue
      const p = r.monk.root.position
      a.set(p.x, p.y + 0.15, p.z)
      b.set(p.x, p.y + 1.05, p.z)
      const onRay = new THREE.Vector3()
      if (ray.distanceSqToSegment(a, b, onRay) < 0.36 * 0.36) {
        const d = onRay.distanceTo(ray.origin)
        if (!best || d < best.d) best = { r, d }
      }
    }
    if (best) return
    const point = this.groundAt(e.clientX, e.clientY)
    if (!point) return
    this.walkTo(point)
    this.pingLayer.click(point.x, groundHeight(point.x, point.z), point.z)
  }

  groundAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect()
    _ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(_ndc, this.camera)
    const hit = this.raycaster.intersectObjects(this.world.groundMeshes, false)[0]
    return hit ? { x: hit.point.x, z: hit.point.z } : null
  }

  ping(kind, point) {
    const next = allowPing(this.pingTimes, performance.now())
    if (!next) {
      this.onNotice('Ping chậm lại một chút nhé.')
      return
    }
    this.pingTimes = next
    this.net.emit('hall:ping', { kind, x: +point.x.toFixed(2), z: +point.z.toFixed(2) })
    this.showPing({ kind, x: point.x, z: point.z, mine: true })
  }

  showPing({ kind, x, z, name, mine }) {
    this.pingLayer.add({ kind, x, y: groundHeight(x, z), z, name, mine })
    this.onPing(kind, mine)
  }

  // ---------- Hành động (gọi từ thanh công cụ / phím tắt) ----------
  walkTo(point, seat = false) {
    this.standUp()
    this.player.route = routeTo(this.player, point)
    this.player.seatOnArrive = seat
    if (!seat) this.lastManual = performance.now()
  }

  standUp() {
    const p = this.player
    if (p.pose === 'standing') return
    if (p.pose === 'bowing') this.net.emit('hall:bow', { active: false })
    else if (p.pose === 'beads') this.net.emit('hall:beads', { active: false })
    this.net.emit('hall:pose', { pose: 'standing' })
    p.pose = 'standing'
    p.base = 'standing'
    this.syncUi()
  }

  toggleBow() {
    const p = this.player
    if (p.pose === 'bowing') {
      this.net.emit('hall:bow', { active: false })
      p.pose = 'standing'
      p.base = 'standing'
    } else {
      if (p.pose === 'beads') this.net.emit('hall:beads', { active: false })
      this.halt()
      this.net.emit('hall:bow', {})
      p.pose = 'bowing'
    }
    this.syncUi()
  }

  pray() {
    const p = this.player
    if (p.pose === 'bowing') this.net.emit('hall:bow', { active: false })
    if (p.pose === 'bowing') p.base = 'standing'
    this.halt()
    this.net.emit('hall:pray', {})
    p.pose = 'praying'
    p.prayUntil = performance.now() + 1100
    this.syncUi()
  }

  setBeads(open) {
    const p = this.player
    if (open && p.pose !== 'beads') {
      if (p.pose === 'bowing') {
        this.net.emit('hall:bow', { active: false })
        p.base = 'standing'
      }
      this.halt()
      this.net.emit('hall:beads', {})
      p.pose = 'beads'
    } else if (!open && p.pose === 'beads') {
      this.net.emit('hall:beads', { active: false })
      p.pose = p.base
    }
    this.syncUi()
  }

  bead() {
    if (this.player.pose === 'beads') this.net.emit('hall:bead', {})
  }

  offerIncense(cb) {
    this.net.emit('hall:incense', {}, (res) => {
      if (res?.ok) {
        this.world.puff()
        this.pray()
      }
      cb?.(res)
    })
  }

  toggleSeat() {
    const p = this.player
    if (p.base === 'kneeling' && p.pose !== 'standing') return this.standUp()
    const c = this.server.cushionId
    if (c !== null && c !== undefined) return this.walkTo(CUSHIONS[c], true)
    if (!this.server.waiting) this.net.emit('hall:claim', {})
  }

  halt() {
    const p = this.player
    p.route = []
    p.vx = p.vz = 0
    this.keys.clear()
  }

  // ---------- Đồng bộ trạng thái server ----------
  applyState(s) {
    this.state = s
    const selfId = this.net.selfId
    if (s.incensePosition && (s.incensePosition.x !== this.incense.x || s.incensePosition.z !== this.incense.z)) {
      this.incense = s.incensePosition
      this.colliders = buildColliders(this.incense)
    }
    const seen = new Set()
    const me = this.player
    const people = (s.people || []).slice().sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))
    for (const person of people) {
      if (person.id === selfId) {
        this.applySelf(person)
        continue
      }
      seen.add(person.id)
      const r = this.remotes.get(person.id)
      if (!r) {
        this.pendingRemotes.set(person.id, person)
        continue
      }
      r.person = person
      const at = performance.now()
      r.buf.push({ t: at, x: person.x, z: person.z })
      while (r.buf.length > 2 && r.buf[1].t < at - INTERP_MS - 400) r.buf.shift()
    }
    for (const id of this.pendingRemotes.keys()) if (!seen.has(id)) this.pendingRemotes.delete(id)
    for (const [id, r] of this.remotes) {
      if (seen.has(id)) continue
      r.monk.dispose()
      r.label.remove()
      this.remotes.delete(id)
    }
  }

  spawnRemotes() {
    // Chia việc dựng nhân vật theo khung hình để phòng đứng yên vẫn hiện đủ người.
    const p = this.player
    const pending = [...this.pendingRemotes.values()].sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))
    for (const person of pending.slice(0, SPAWN_PER_FRAME)) {
      const r = { monk: new Monk(this.templates.lod), person, x: person.x, z: person.z, rot: person.rotation,
        label: this.makeLabel(''), buf: [{ t: performance.now(), x: person.x, z: person.z }], speed: 0, heading: person.rotation }
      r.monk.root.position.set(person.x, groundHeight(person.x, person.z), person.z)
      this.scene.add(r.monk.root)
      this.remotes.set(person.id, r)
      this.pendingRemotes.delete(person.id)
    }
  }

  applySelf(person) {
    const prev = this.server
    this.server = { id: person.id, cushionId: person.cushionId, waiting: person.waiting, beads: person.beads, name: person.name, x: person.x, z: person.z, pose: person.pose }
    const p = this.player
    p.pose = person.pose
    if (person.pose === 'standing' || person.pose === 'kneeling') p.base = person.pose
    if (person.pose === 'praying') p.prayUntil = performance.now() + Math.max(0, person.poseUntil - Date.now())
    const rejoined = prev.id && prev.id !== person.id
    if (rejoined) {
      this.halt()
      this.handledCushion = undefined
      this.lastManual = -Infinity
    }
    if (rejoined || (Math.hypot(person.x - p.x, person.z - p.z) > 2.5 && !p.route.length && !this.keys.size)) {
      p.x = person.x
      p.z = person.z
      p.vx = p.vz = 0
      this.sent = { ...this.sent, x: person.x, z: person.z }
    }
    // Lần đầu có dữ liệu, hoặc được cấp nệm mới: tự bước tới nếu người dùng không đang tự đi.
    if (person.cushionId !== null && person.cushionId !== this.handledCushion) {
      this.handledCushion = person.cushionId
      const idle = performance.now() - this.lastManual > 2500 && !this.keys.size
      if (idle && p.pose === 'standing') this.walkTo(CUSHIONS[person.cushionId], true)
    } else if (person.cushionId === null) this.handledCushion = null
    if (prev.beads !== person.beads || prev.cushionId !== person.cushionId || prev.waiting !== person.waiting || prev.name !== person.name || prev.pose !== person.pose) this.syncUi()
  }

  syncUi() {
    const p = this.player
    const zone = zoneAt(p.x, p.z)
    const ui = {
      zone,
      pose: p.pose,
      kneeling: p.base === 'kneeling',
      nearIncense: Math.hypot(p.x - this.incense.x, p.z - this.incense.z) <= INCENSE_RANGE,
      cushionId: this.server.cushionId,
      waiting: this.server.waiting,
      beads: this.server.beads,
      name: this.server.name,
    }
    if (Object.keys(ui).some((k) => ui[k] !== this.ui[k])) {
      this.ui = ui
      this.onUi(ui)
    }
  }

  // ---------- Khung hình ----------
  frame() {
    const raw = this.clock.getDelta()
    const dt = Math.min(0.05, raw)
    this.frameNo++
    if (this.frameNo > 30) this.adaptResolution(raw)
    const now = performance.now()
    const wall = Date.now()
    this.updatePlayer(dt, now)
    this.spawnRemotes()
    this.updateRemotes(dt, wall)
    this.updateCamera(dt)
    this.world.update(dt, wall, this.state?.incense || [])
    this.zoneTimer -= dt
    if (this.zoneTimer <= 0) {
      this.zoneTimer = 0.25
      this.cullZones()
      this.syncUi()
    }
    this.renderer.render(this.scene, this.camera)
    this.updateLabels()
    this.pingLayer.update(now, (el, x, y, z) => this.placeLabel(el, x, y, z))
  }

  updatePlayer(dt, now) {
    const p = this.player
    let ix = 0
    let iz = 0
    const k = this.keys
    if (k.has('w') || k.has('arrowup')) iz -= 1
    if (k.has('s') || k.has('arrowdown')) iz += 1
    if (k.has('a') || k.has('arrowleft')) ix -= 1
    if (k.has('d') || k.has('arrowright')) ix += 1
    let desiredX = 0
    let desiredZ = 0
    if (ix || iz) {
      if (p.pose !== 'standing') this.standUp()
      p.route = []
      this.lastManual = now
      const len = Math.hypot(ix, iz)
      const sin = Math.sin(this.view.yaw)
      const cos = Math.cos(this.view.yaw)
      desiredX = ((ix * cos + iz * sin) / len) * WALK_SPEED
      desiredZ = ((-ix * sin + iz * cos) / len) * WALK_SPEED
    } else if (p.route.length) {
      const target = p.route[0]
      const dx = target.x - p.x
      const dz = target.z - p.z
      const d = Math.hypot(dx, dz)
      const last = p.route.length === 1
      if (d < (last ? 0.06 : 0.35)) {
        p.route.shift()
        if (last) this.arrive()
      } else {
        const speed = last ? Math.min(WALK_SPEED, d * 1.6 + 0.12) : WALK_SPEED
        desiredX = (dx / d) * speed
        desiredZ = (dz / d) * speed
      }
    }
    // Bấm là đi ngay: vận tốc đạt ~80% sau 0,2 giây, dừng vẫn êm (đuổi vận tốc đích theo hàm mũ).
    const kv = 1 - Math.exp(-dt * (desiredX || desiredZ ? 8 : 7))
    p.vx += (desiredX - p.vx) * kv
    p.vz += (desiredZ - p.vz) * kv
    if (!desiredX && !desiredZ && Math.hypot(p.vx, p.vz) < 0.01) p.vx = p.vz = 0
    const speed = Math.hypot(p.vx, p.vz)
    if (speed > 0.001) {
      const next = resolveCollisions(p.x + p.vx * dt, p.z + p.vz * dt, this.colliders)
      p.x = next.x
      p.z = next.z
    }
    // Xoay về hướng muốn đi (không đợi vận tốc đổi hướng) nên vừa xoay vừa bước, không xoay tại chỗ rồi mới đi.
    if (desiredX || desiredZ) p.rot = angleLerp(p.rot, Math.atan2(desiredX, desiredZ), 1 - Math.exp(-dt * 14))
    else if (speed > 0.12) p.rot = angleLerp(p.rot, Math.atan2(p.vx, p.vz), 1 - Math.exp(-dt * 10))
    if (p.pose === 'kneeling' || (p.base === 'kneeling' && p.pose !== 'standing')) p.rot = angleLerp(p.rot, Math.PI, 1 - Math.exp(-dt * 6))
    if (p.pose === 'praying' && now > p.prayUntil) {
      p.pose = p.base
      this.syncUi()
    }
    const onCushion = p.base === 'kneeling' && p.pose !== 'standing' ? CUSHION_TOP : 0
    const floorHeight = groundHeight(p.x, p.z) + onCushion
    p.y += (floorHeight - p.y) * (1 - Math.exp(-dt * 12))
    this.me.root.position.set(p.x, p.y, p.z)
    this.me.setGroundHeight(floorHeight)
    this.me.root.rotation.y = p.rot
    this.me.update(dt, { pose: this.animPose(p.pose, p.base), moving: speed / WALK_SPEED, dance: zoneAt(p.x, p.z) === 'moon', now: Date.now() })
    this.sendMove(now)
  }

  animPose(pose, base) {
    if (base !== 'kneeling') return pose
    if (pose === 'bowing') return 'bowing-kneel'
    if (pose === 'praying') return 'praying-kneel'
    if (pose === 'beads') return 'beads-kneel'
    return pose
  }

  arrive() {
    const p = this.player
    p.vx = p.vz = 0
    if (!p.seatOnArrive) return
    p.seatOnArrive = false
    p.rot = Math.PI
    this.sendMove(performance.now(), true)
    this.net.emit('hall:pose', { pose: 'kneeling' })
    p.pose = 'kneeling'
    p.base = 'kneeling'
    this.syncUi()
  }

  sendMove(now, force = false) {
    const p = this.player
    if (p.pose !== 'standing' && !force) return
    if (now - this.sent.at < SEND_MS && !force) return
    const dx = p.x - this.sent.x
    const dz = p.z - this.sent.z
    const d = Math.hypot(dx, dz)
    const turned = Math.abs(angleLerp(this.sent.rot, p.rot, 1) - this.sent.rot) > 0.05
    if (d < 0.01 && !turned) return
    // Server giới hạn tốc độ: mỗi gói tối đa MAX_STEP so với gói trước.
    const k = d > MAX_STEP ? MAX_STEP / d : 1
    const msg = { x: +(this.sent.x + dx * k).toFixed(3), z: +(this.sent.z + dz * k).toFixed(3), rotation: +p.rot.toFixed(3) }
    this.sent = { x: msg.x, z: msg.z, rot: p.rot, at: now }
    this.net.emit('hall:move', msg, (res) => {
      if (res && res.ok === false) this.sent = { ...this.sent, x: this.server.x, z: this.server.z }
    })
  }

  updateRemotes(dt, wall) {
    const px = this.player.x
    const pz = this.player.z
    const k = 1 - Math.exp(-dt * 8)
    const renderAt = performance.now() - INTERP_MS
    // Mesh có xương tắt frustumCulled (bounding sphere sai khi cử động), nên tự cắt theo khung nhìn.
    this.camera.updateMatrixWorld()
    _frustum.setFromProjectionMatrix(_m4.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse))
    for (const r of this.remotes.values()) {
      const person = r.person
      this.sample(r, renderAt)
      const dist = Math.hypot(r.x - px, r.z - pz)
      _sphere.center.set(r.x, r.monk.root.position.y + 0.55, r.z)
      const visible = dist < VIEW_RANGE && _frustum.intersectsSphere(_sphere)
      r.monk.root.visible = visible
      if (!visible) continue
      const cushion = person.cushionId !== null ? CUSHIONS[person.cushionId] : null
      const onCushion = cushion && Math.hypot(person.x - cushion.x, person.z - cushion.z) < 0.2
      const kneel = person.pose === 'kneeling' || (onCushion && ['bowing', 'praying', 'beads'].includes(person.pose))
      const targetRot = kneel ? Math.PI : r.speed > 0.15 ? r.heading : person.rotation
      r.rot = angleLerp(r.rot, targetRot, 1 - Math.exp(-dt * 7))
      const root = r.monk.root
      const floorHeight = groundHeight(r.x, r.z) + (kneel && onCushion ? CUSHION_TOP : 0)
      root.position.set(r.x, root.position.y + (floorHeight - root.position.y) * k, r.z)
      r.monk.setGroundHeight(floorHeight)
      root.rotation.y = r.rot
      // ponytail: người ở xa cập nhật xương thưa hơn (1/2, 1/3 khung); cần mượt hơn nữa thì thêm LOD xương.
      const stride = dist > 18 ? 3 : dist > 10 ? 2 : 1
      r.animDt = (r.animDt || 0) + dt
      if ((this.frameNo + r.monk.root.id) % stride) continue
      r.monk.update(r.animDt, { pose: this.animPose(person.pose, kneel ? 'kneeling' : 'standing'), moving: Math.min(1, r.speed / WALK_SPEED), dance: zoneAt(r.x, r.z) === 'moon', now: wall })
      r.animDt = 0
    }
  }

  // Nội suy vị trí giữa hai mốc server bao quanh thời điểm vẽ; quá mốc cuối thì đứng yên chờ gói sau.
  sample(r, at) {
    const buf = r.buf
    if (!buf.length) return
    let a = buf[0]
    let b = buf[buf.length - 1]
    for (let i = 0; i < buf.length - 1; i++) {
      if (buf[i + 1].t >= at) {
        a = buf[i]
        b = buf[i + 1]
        break
      }
    }
    if (at >= b.t) {
      r.x = b.x
      r.z = b.z
      r.speed = 0
      return
    }
    const span = Math.max(1, b.t - a.t)
    const t = Math.max(0, Math.min(1, (at - a.t) / span))
    r.x = a.x + (b.x - a.x) * t
    r.z = a.z + (b.z - a.z) * t
    const dx = b.x - a.x
    const dz = b.z - a.z
    r.speed = Math.hypot(dx, dz) / (span / 1000)
    if (r.speed > 0.15) r.heading = Math.atan2(dx, dz)
  }

  updateCamera(dt) {
    const p = this.player
    const o = this.orbit
    const v = this.view
    // Xoay theo chuột 1:1 (làm mượt góc xoay là thứ gây cảm giác "trôi"); chỉ zoom được làm mượt.
    v.yaw = o.yaw
    v.pitch = o.pitch
    const previousDist = v.dist
    v.dist *= Math.exp(Math.log(o.dist / v.dist) * (1 - Math.exp(-dt * 12)))
    // Bám nhân vật ngay theo mặt sàn; chỉ độ cao được làm mượt để lên xuống bậc không giật.
    if (!this.camTarget) this.camTarget = new THREE.Vector3(p.x, p.y + 1.0, p.z)
    this.camTarget.x = p.x
    this.camTarget.z = p.z
    this.camTarget.y += (p.y + 1.0 - this.camTarget.y) * (1 - Math.exp(-dt * 10))
    // Tường/mái chắn: thử nâng camera dần lên để nhìn qua vai; vẫn chắn thì kéo lại gần.
    const want = Math.min(v.dist, 1.2)
    let d = -1
    let lift = 0
    for (const extra of [0, 0.35, 0.7, Math.max(0, 1.1 - v.pitch)]) {
      const pt = v.pitch + extra
      _dir.set(Math.sin(v.yaw) * Math.cos(pt), Math.sin(pt), Math.cos(v.yaw) * Math.cos(pt))
      this.raycaster.set(this.camTarget, _dir)
      this.raycaster.far = v.dist
      const hit = this.raycaster.intersectObjects(this.world.occluders, true)[0]
      const free = hit ? Math.max(0.6, hit.distance - 0.3) : v.dist
      if (free > d) {
        d = free
        lift = extra
      }
      if (free >= want) break
    }
    this.raycaster.far = Infinity
    // Chỉ phần "nâng lên vì bị chắn" và khoảng cách bị chắn mới làm mượt; hướng nhìn của người dùng thì không.
    this.camLift = this.camLift === undefined ? lift : this.camLift + (lift - this.camLift) * (1 - Math.exp(-dt * 10))
    if (this.camDist === undefined) this.camDist = d
    else {
      // Zoom chỉ làm mượt một lần; phần hồi khoảng cách sau vật cản có nhịp riêng.
      this.camDist *= v.dist / previousDist
      this.camDist = Math.min(d, this.camDist + (d - this.camDist) * (1 - Math.exp(-dt * 8)))
    }
    const pt = v.pitch + this.camLift
    if (!this.camDir) this.camDir = new THREE.Vector3()
    this.camDir.set(Math.sin(v.yaw) * Math.cos(pt), Math.sin(pt), Math.cos(v.yaw) * Math.cos(pt))
    if (this.camLift > 0.001) {
      // Góc nâng đang chuyển tiếp vẫn phải kiểm tra theo tia camera thực tế.
      this.raycaster.set(this.camTarget, this.camDir)
      this.raycaster.far = this.camDist
      const hit = this.raycaster.intersectObjects(this.world.occluders, true)[0]
      if (hit) this.camDist = Math.min(this.camDist, Math.max(0.6, hit.distance - 0.3))
      this.raycaster.far = Infinity
    }
    const pos = this.camera.position.copy(this.camTarget).addScaledVector(this.camDir, this.camDist)
    pos.y = Math.max(pos.y, groundHeight(pos.x, pos.z) + 0.25)
    // Camera càng bị kéo gần thì càng nhìn qua vai về phía trước, không cắm xuống đỉnh đầu.
    const ahead = Math.max(0, 2.4 - this.camDist)
    _look.copy(this.camTarget)
    _look.x -= this.camDir.x * ahead
    _look.z -= this.camDir.z * ahead
    this.camera.lookAt(_look)
    // Bóng đổ đi theo nhân vật nhưng khoá theo lưới texel của shadow map.
    const sun = this.world.sun
    _target.set(p.x, 0, p.z)
    const sr = Math.round(_target.dot(SUN_RIGHT) / SHADOW_TEXEL) * SHADOW_TEXEL
    const su = Math.round(_target.dot(SUN_UP) / SHADOW_TEXEL) * SHADOW_TEXEL
    const sf = _target.dot(SUN_FWD)
    sun.target.position.copy(SUN_RIGHT).multiplyScalar(sr).addScaledVector(SUN_UP, su).addScaledVector(SUN_FWD, sf)
    sun.position.copy(sun.target.position).add(SUN_OFFSET)
  }

  // Độ phân giải tự điều chỉnh: khung hình chậm kéo dài thì hạ, nhanh lâu thì nâng lại.
  adaptResolution(dt) {
    if (dt > 1 / 45) {
      this.slowTime += dt
      this.fastTime = 0
    } else if (dt < 1 / 75) {
      this.fastTime += dt
      this.slowTime = Math.max(0, this.slowTime - dt)
    }
    let next = this.pixelRatio
    if (this.slowTime > 1.5) next = Math.max(PIXEL_RATIO_MIN, this.pixelRatio - 0.25)
    else if (this.fastTime > 20) next = Math.min(Math.min(window.devicePixelRatio, PIXEL_RATIO_MAX), this.pixelRatio + 0.25)
    if (next !== this.pixelRatio) {
      this.pixelRatio = next
      this.renderer.setPixelRatio(next)
      this.resize()
      this.slowTime = this.fastTime = 0
    }
  }

  cullZones() {
    const p = this.player
    for (const [name, info] of Object.entries(this.world.zoneInfo)) {
      this.world.zones[name].visible = Math.hypot(p.x - info.x, p.z - info.z) - info.r < 34
    }
  }

  // ---------- Nhãn tên ----------
  makeLabel(extra) {
    const el = document.createElement('div')
    el.className = `hall-label ${extra}`
    this.labelsEl.appendChild(el)
    return el
  }

  // Chỉ ghi style khi nhãn thật sự dịch (> nửa pixel) hoặc đổi ẩn/hiện: hàng trăm nhãn đứng yên
  // không bắt trình duyệt tính lại style mỗi khung.
  placeLabel(el, x, y, z) {
    const v = _label.set(x, y, z).project(this.camera)
    const hidden = v.z > 1
    if (hidden !== el._hidden) {
      el.style.visibility = hidden ? 'hidden' : ''
      el._hidden = hidden
    }
    if (hidden) return
    // Kích thước lấy từ resize(): đọc clientWidth sau khi vừa ghi style là ép trình duyệt tính lại bố cục.
    const px = ((v.x + 1) / 2) * this.viewW
    const py = ((1 - v.y) / 2) * this.viewH
    if (Math.abs(px - (el._px ?? -1e9)) < 0.5 && Math.abs(py - (el._py ?? -1e9)) < 0.5) return
    el._px = px
    el._py = py
    el.style.transform = `translate(-50%, -100%) translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`
  }

  updateLabels() {
    const p = this.player
    const name = this.server.name || this.net.name || ''
    const text = `Bạn: ${name}`
    if (this.selfLabel.textContent !== text) this.selfLabel.textContent = text
    const lift = p.base === 'kneeling' && p.pose !== 'standing' ? 0.95 : 1.35
    this.placeLabel(this.selfLabel, p.x, p.y + lift, p.z)
    for (const r of this.remotes.values()) {
      r.label.classList.toggle('is-shown', r.monk.root.visible)
      if (!r.monk.root.visible) continue
      if (r.label.textContent !== r.person.name) r.label.textContent = r.person.name
      const pos = r.monk.root.position
      this.placeLabel(r.label, pos.x, pos.y + (r.person.pose === 'kneeling' ? 0.95 : 1.35), pos.z)
    }
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    this.viewW = w
    this.viewH = h
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.disposed = true
    this.unsub?.()
    this.unsubPing?.()
    this.pingLayer?.dispose()
    this.unbind?.()
    if (this.renderer) {
      this.renderer.setAnimationLoop(null)
      this.renderer.dispose()
    }
    this.pendingRemotes.clear()
    this.remotes.forEach((r) => r.label.remove())
    this.selfLabel?.remove()
    if (import.meta.env.DEV && window.__hall === this) delete window.__hall
  }
}
