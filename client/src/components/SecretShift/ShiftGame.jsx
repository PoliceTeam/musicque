import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { sampleMotion } from './motion'
import { SUIT_COLORS } from './palette'

const DIRECTIONS = ['down', 'left', 'right', 'up']
const isTextInput = (target) => target?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')
const RAYS = Array.from({ length: 160 }, (_, i) => ({ x: Math.cos(Math.PI * 2 * i / 160), y: Math.sin(Math.PI * 2 * i / 160) }))

// Tia nhìn dừng ở tường, dùng cùng hình học với server.
const visionPolygon = (map, self, radius) => {
  const points = []
  const walls = map.walls.filter((w) => w.x <= self.x + radius && w.x + w.width >= self.x - radius &&
    w.y <= self.y + radius && w.y + w.height >= self.y - radius)
  for (const { x: dx, y: dy } of RAYS) {
    let length = radius
    for (const wall of walls) {
      const ax = (wall.x - self.x) / dx; const bx = (wall.x + wall.width - self.x) / dx
      const ay = (wall.y - self.y) / dy; const by = (wall.y + wall.height - self.y) / dy
      const enter = Math.max(Math.min(ax, bx), Math.min(ay, by)); const exit = Math.min(Math.max(ax, bx), Math.max(ay, by))
      if (enter >= 0 && enter <= exit) length = Math.min(length, enter)
    }
    points.push({ x: self.x + dx * length, y: self.y + dy * length })
  }
  return points
}

class ShiftScene extends Phaser.Scene {
  constructor(map, callbacks) {
    super('secret-shift'); this.map = map; this.callbacks = callbacks
    this.actors = new Map(); this.bodies = new Map(); this.held = new Set(); this.lastSent = 0
  }
  preload() {
    if (this.map.presentation?.kind === 'among-us-reference') {
      const art = this.map.presentation
      this.load.image('shift-reference-map', art.background)
      this.load.image('shift-reference-worker', art.sprite)
      this.load.image('shift-reference-body', art.body)
      this.load.image('shift-reference-ghost', art.ghost)
      return
    }

  }
  create() {
    const map = this.map
    this.reference = map.presentation?.kind === 'among-us-reference'
    this.workerWidth = this.reference ? map.presentation.workerWidth : 51.2
    this.workerHeight = this.reference ? map.presentation.workerHeight : 51.2
    // Mask gốc lấy điểm ở giữa ngang và cách đáy sprite 10/83 chiều cao.
    this.spriteOffset = this.reference ? this.workerHeight * (0.5 - 10 / 83) : 14
    if (this.reference) {
      this.add.image(0, 0, 'shift-reference-map').setOrigin(0).setDisplaySize(map.width, map.height)
      this.createSuitTextures()
    }
    for (const vent of map.vents || []) {
      this.add.rectangle(vent.x, vent.y, 22, 12, 0x273845).setStrokeStyle(2, 0x92a3ad)
    }
    for (const panel of map.reactorPanels || []) this.add.text(panel.x, panel.y - 18, '▣', { fontSize: '18px', color: '#60bf91' }).setOrigin(0.5)
    this.stationMarkers = new Map()
    for (const t of map.stations) {
      const marker = this.add.circle(t.x, t.y, 18, 0x82929d).setStrokeStyle(3, 0x1a314b)
      const symbol = { wiring: 'ϟ', code: '#', restart: '↻', navigation: '⊕', garbage: '↓', fuel: '▥' }[t.kind]
      this.add.text(t.x, t.y, symbol, { fontSize: '24px', color: '#fff', fontFamily: 'Arial', fontStyle: 'bold' }).setOrigin(0.5)
      this.stationMarkers.set(t.id, marker)
    }
    this.add.circle(map.emergency.x, map.emergency.y, this.reference ? 12 : 18, 0xed7884, this.reference ? 0.5 : 1).setStrokeStyle(2, 0xffffff)
    this.add.text(map.emergency.x, map.emergency.y, '!', { fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(map.emergency.x, map.emergency.y + 28, 'HỌP KHẨN', { fontFamily: 'Arial', fontSize: '11px', color: '#486070' }).setOrigin(0.5)
    // Vẽ tam giác trực tiếp, tránh tải lại texture canvas 1600×1120 lên GPU mỗi snapshot.
    this.fog = this.add.graphics().setDepth(5000)
    // Khung camera ôm sát vùng nhìn bình thường; không chặn ở mép map.
    // Nhờ vậy nhân vật luôn ở tâm, kể cả khi đứng sát biên hoặc đi dưới dạng hồn ma.
    this.resizeCamera = () => {
      const camera = this.cameras.main
      // Đường chéo khung bằng đường kính tầm nhìn: không chừa vùng ngoài vòng sáng.
      camera.setZoom(Math.hypot(camera.width, camera.height) / 600)
    }
    this.cameras.main.setBackgroundColor('#0d1927')
    this.resizeCamera()
    this.scale.on('resize', this.resizeCamera)
    const canvas = this.game.canvas
    canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Bản đồ Ca trực bí mật. WASD hoặc mũi tên để đi, E tương tác, Q loại người.')
    this.down = (event) => {
      if (isTextInput(event.target) || document.activeElement !== canvas) return
      const key = event.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        event.preventDefault(); this.held.add(key)
      }
      if (!event.repeat && key === 'e') this.callbacks.interact()
      if (!event.repeat && key === 'q') this.callbacks.kill()
    }
    this.up = (event) => this.held.delete(event.key.toLowerCase())
    this.blur = () => { this.held.clear(); this.callbacks.input({ x: 0, y: 0 }) }
    this.focus = () => canvas.focus()
    window.addEventListener('keydown', this.down); window.addEventListener('keyup', this.up)
    window.addEventListener('blur', this.blur); canvas.addEventListener('blur', this.blur)
    canvas.addEventListener('pointerdown', this.focus)
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.resizeCamera)
      window.removeEventListener('keydown', this.down); window.removeEventListener('keyup', this.up)
      window.removeEventListener('blur', this.blur); canvas.removeEventListener('blur', this.blur)
      canvas.removeEventListener('pointerdown', this.focus)
      this.callbacks.input({ x: 0, y: 0 })
    })
    this.ready = true
    if (this.pendingState) this.setState(this.pendingState)
  }
  createSuitTextures() {
    const source = this.textures.get('shift-reference-worker').getSourceImage()
    for (let skin = 0; skin < 8; skin++) {
      // Palette đỏ/xanh lá/xanh dương của nguồn được đổi màu lúc load trong Phaser.
      // Thu nhỏ texture runtime; giữ nguyên các PNG nguồn và giấy phép kèm repo.
      const canvas = document.createElement('canvas'); canvas.width = 1170; canvas.height = 140
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
      const image = context.getImageData(0, 0, canvas.width, canvas.height)
      const suit = Phaser.Display.Color.HexStringToColor(SUIT_COLORS[skin])
      for (let i = 0; i < image.data.length; i += 4) {
        const r = image.data[i]; const g = image.data[i + 1]; const b = image.data[i + 2]
        if (!image.data[i + 3] || Math.max(r, g, b) < 45) continue
        let color; let strength
        if (r > g * 1.3 && r > b * 1.3) { color = [suit.red, suit.green, suit.blue]; strength = r / 255 }
        else if (b > r * 1.3 && b > g * 1.3) { color = [suit.red * 0.5, suit.green * 0.5, suit.blue * 0.5]; strength = b / 255 }
        else if (g > r * 1.3 && g > b * 1.3) { color = [155, 218, 236]; strength = g / 255 }
        if (color) for (let channel = 0; channel < 3; channel++) image.data[i + channel] = color[channel] * strength
      }
      context.putImageData(image, 0, 0)
      this.textures.addSpriteSheet(`shift-worker-${skin}`, canvas, { frameWidth: 90, frameHeight: 140 })
      for (const kind of ['body', 'ghost']) {
        const source = this.textures.get(`shift-reference-${kind}`).getSourceImage()
        const texture = document.createElement('canvas'); texture.width = source.width; texture.height = source.height
        const ctx = texture.getContext('2d', { willReadFrequently: true }); ctx.drawImage(source, 0, 0)
        const pixels = ctx.getImageData(0, 0, texture.width, texture.height)
        for (let i = 0; i < pixels.data.length; i += 4) {
          const r = pixels.data[i]; const g = pixels.data[i + 1]; const b = pixels.data[i + 2]
          if (!pixels.data[i + 3] || Math.max(r, g, b) < 45) continue
          let color; let strength
          if (r > g * 1.3 && r > b * 1.3) { color = [suit.red, suit.green, suit.blue]; strength = r / 255 }
          else if (b > r * 1.3 && b > g * 1.3) { color = [suit.red * 0.5, suit.green * 0.5, suit.blue * 0.5]; strength = b / 255 }
          else if (g > r * 1.3 && g > b * 1.3) { color = [155, 218, 236]; strength = g / 255 }
          if (color) for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] = color[channel] * strength
        }
        ctx.putImageData(pixels, 0, 0); this.textures.addCanvas(`shift-${kind}-${skin}`, texture)
      }
    }
    this.textures.remove('shift-reference-worker')
  }
  setState(state) {
    if (!this.ready) { this.pendingState = state; return }
    const phaseChanged = this.state?.phase !== state.phase
    this.state = state
    const present = new Set(state.players.map((p) => p.userId))
    for (const [id, actor] of this.actors) if (!present.has(id)) {
      actor.sprite.destroy(); actor.label.destroy(); this.actors.delete(id)
    }
    for (const p of state.players) {
      let actor = this.actors.get(p.userId)
      if (!actor) {
        actor = { sprite: this.add.sprite(p.x, p.y - this.spriteOffset, `shift-worker-${p.skin}`).setDisplaySize(this.workerWidth, this.workerHeight).setDepth(6000),
          label: this.add.text(p.x, p.y - 50, p.displayName.length > 12 ? `${p.displayName.slice(0, 11)}…` : p.displayName, { fontFamily: 'Arial', fontSize: this.reference ? '8px' : '12px',
            color: '#fff', backgroundColor: '#1a314b', padding: { x: this.reference ? 3 : 5, y: this.reference ? 2 : 3 } }).setOrigin(0.5).setDepth(6100) }
        this.actors.set(p.userId, actor)
      }
      if (phaseChanged || !actor.samples) actor.samples = []
      if (actor.samples.at(-1)?.time !== state.serverNow) {
        actor.samples.push({ time: state.serverNow, x: p.x, y: p.y })
        if (actor.samples.length > 8) actor.samples.shift()
      }
      actor.target = p
      if (this.reference) actor.sprite.setTexture(`shift-${p.alive ? 'worker' : 'ghost'}-${p.skin}`).setDisplaySize(this.workerWidth, this.workerHeight)
      actor.sprite.setAlpha(p.alive ? (p.connected ? 1 : 0.4) : 0.4)
      if (!p.alive && !this.reference) actor.sprite.setTint(0x74ddf3)
      else actor.sprite.clearTint()
    }
    const bodyIds = new Set(state.bodies.map((b) => b.id))
    for (const [id, body] of this.bodies) if (!bodyIds.has(id)) { body.destroy(); this.bodies.delete(id) }
    for (const b of state.bodies) {
      if (this.bodies.has(b.id)) continue
      const color = Phaser.Display.Color.HexStringToColor(b.color).color
      const skin = b.skin ?? state.roster.find(p => p.userId === b.userId)?.skin ?? 0
      const badge = this.reference
        ? this.add.image(b.x, b.y, `shift-body-${skin}`).setOrigin(0.5, 0.9).setDisplaySize(this.workerWidth * 76 / 64, this.workerHeight * 58 / 86).setDepth(5900)
        : this.add.rectangle(b.x, b.y, 24, 30, 0xffffff).setStrokeStyle(4, color).setAngle(20).setDepth(5900)
      this.bodies.set(b.id, badge)
    }
    for (const [id, marker] of this.stationMarkers) {
      const task = state.me.tasks.find((t) => t.id === id)
      marker.setFillStyle(task ? task.done ? 0x60bf91 : 0xefb344 : 0x82929d)
    }
    this.held = state.phase === 'playing' && !state.me.challenge ? this.held : new Set()
  }
  drawFog(self) {
    const s = this.state
    const active = s.phase === 'playing' && s.me.alive
    const radius = s.lightsUntil ? 105 : 300
    const old = this.lastFog
    if (old && old.active === active && old.radius === radius && Math.hypot(old.x - self.x, old.y - self.y) < 0.25) return
    this.lastFog = { ...self, active, radius }
    this.fog.clear()
    if (!active) return
    const points = visionPolygon(this.map, self, radius)
    const far = Math.max(this.map.width, this.map.height) * 4
    this.fog.fillStyle(0x0d1927, 0.97)
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length
      const a = points[i]; const b = points[j]
      const ax = self.x + RAYS[i].x * far; const ay = self.y + RAYS[i].y * far
      const bx = self.x + RAYS[j].x * far; const by = self.y + RAYS[j].y * far
      this.fog.fillTriangle(a.x, a.y, ax, ay, bx, by)
      this.fog.fillTriangle(a.x, a.y, bx, by, b.x, b.y)
    }
  }
  update(time) {
    if (import.meta.env.DEV) {
      const frameNow = performance.now()
      if (this.frameAt) {
        const gap = frameNow - this.frameAt
        this.frameSamples ||= []
        this.frameSamples.push(gap)
        if (this.frameSamples.length > 180) this.frameSamples.shift()
        if (!this.statsAt || frameNow - this.statsAt > 1000) {
          const frames = this.frameSamples
          this.game.canvas.dataset.fps = (1000 * frames.length / frames.reduce((a, b) => a + b, 0)).toFixed(1)
          this.game.canvas.dataset.frameP95 = [...frames].sort((a, b) => a - b)[Math.floor(frames.length * 0.95)].toFixed(1)
          this.statsAt = frameNow
        }
      }
      this.frameAt = frameNow
    }
    if (!this.state) return
    const s = this.state
    const renderTime = Date.now() + (s.clockOffset || 0) - 100
    const enabled = s.phase === 'playing' && !s.me.challenge && document.activeElement === this.game.canvas && this.callbacks.online()
    const pressed = (...keys) => enabled && keys.some((k) => this.held.has(k))
    if (time - this.lastSent >= 50) {
      this.callbacks.input({ x: Number(pressed('d', 'arrowright')) - Number(pressed('a', 'arrowleft')),
        y: Number(pressed('s', 'arrowdown')) - Number(pressed('w', 'arrowup')) })
      this.lastSent = time
    }
    for (const [id, actor] of this.actors) {
      const p = actor.target
      const position = sampleMotion(actor.samples, s.phase === 'playing' ? renderTime : s.serverNow)
      actor.sprite.setPosition(position.x, position.y - this.spriteOffset)
      actor.label.setPosition(actor.sprite.x, actor.sprite.y - (this.reference ? this.workerHeight / 2 + 8 : 35))
      if (this.reference) {
        if (p.alive) actor.sprite.setFrame(p.moving ? 1 + Math.floor(time / 67) % 12 : 0)
        if (p.direction === 'left' || p.direction === 'right') actor.sprite.setFlipX(p.direction === 'left')
      } else actor.sprite.setFrame(Math.max(0, DIRECTIONS.indexOf(p.direction)) * 3 + (p.moving ? Math.floor(time / 130) % 3 : 0))
      if (id === s.me.userId) {
        this.cameras.main.centerOn(actor.sprite.x, actor.sprite.y)
        this.drawFog(position)
      }
    }
  }
}

const ShiftGame = ({ state, socket, online, onInteract, onKill }) => {
  const host = useRef(null); const scene = useRef(null)
  const callbacks = useRef({ online, onInteract, onKill })
  callbacks.current = { online, onInteract, onKill }
  const map = state.map
  useEffect(() => {
    const current = new ShiftScene(map, {
      input: (data) => socket?.connected && socket.emit('shift:input', data),
      interact: () => callbacks.current.onInteract(), kill: () => callbacks.current.onKill(),
      online: () => callbacks.current.online,
    })
    scene.current = current
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: host.current,
      width: host.current.clientWidth, height: host.current.clientHeight,
      backgroundColor: '#f4efdf', scene: current,
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
      input: { keyboard: false }, render: { antialias: true },
    })
    return () => { scene.current = null; game.destroy(true) }
  }, [map, socket])
  useEffect(() => { scene.current?.setState(state) }, [state])
  return <div className='shift-canvas' ref={host} />
}
export default ShiftGame
