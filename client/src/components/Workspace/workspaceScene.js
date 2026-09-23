import Phaser from 'phaser'

export const WORLD_WIDTH = 1600
export const WORLD_HEIGHT = 900

export const ZONES = [
  { id: 'music', label: 'MUSIC CLUB', hint: 'Order nhạc', x: 300, y: 410, width: 380, height: 320, color: 0x8b5cf6 },
  { id: 'game', label: 'ARCADE', hint: 'Chơi game', x: 800, y: 410, width: 380, height: 320, color: 0xf43f5e },
  { id: 'news', label: 'NEWS CAFE', hint: 'Đọc báo', x: 1300, y: 410, width: 380, height: 320, color: 0x06b6d4 },
]

const CHARACTER_SHEET = '/workspace-assets/Small-8-Direction-Characters_by_AxulArt/Small-8-Direction-Characters_by_AxulArt.png'
const DIRECTIONS = ['up', 'up-right', 'right', 'down-right', 'down', 'down-left', 'left', 'up-left']
const CHARACTER_COUNT = 3
const FRAMES_PER_ROW = 8
const ROWS_PER_CHARACTER = 4

const FURNITURE_PATH = '/workspace-assets/kenney-furniture'

const CORE_BUBBLE_COLORS = {
  'polite-blue': { accent: 0x4887e8, glow: 0x9bc5ff, ink: '#2257a2' },
  'polite-red': { accent: 0xe6667c, glow: 0xffb0bb, ink: '#a33149' },
  'polite-yellow': { accent: 0xe8a52d, glow: 0xffda78, ink: '#865c10' },
  'polite-green': { accent: 0x43a97d, glow: 0x9ce6c3, ink: '#247457' },
}
const LEGACY_CORE_BUBBLE_STYLES = {
  aurora: 'polite-blue', solar: 'polite-yellow', neon: 'polite-blue',
  ruby: 'polite-red', crystal: 'polite-blue',
}

const activeCore = (core) => Boolean(
  core?.active && core?.expiresAt && new Date(core.expiresAt).getTime() > Date.now(),
)

const corePalette = (core) => {
  const style = LEGACY_CORE_BUBBLE_STYLES[core?.style] || core?.style
  return CORE_BUBBLE_COLORS[style] || CORE_BUBBLE_COLORS['polite-blue']
}

const furnitureAssets = {
  bookcase: 'bookcaseOpen_SE.png',
  bookcaseLow: 'bookcaseOpenLow_SE.png',
  chair: 'chairDesk_SE.png',
  monitor: 'computerScreen_SE.png',
  desk: 'desk_SE.png',
  sofa: 'loungeSofa_SE.png',
  plant: 'plantSmall1_SE.png',
  plantAlt: 'plantSmall2_SE.png',
  radio: 'radio_SE.png',
  speaker: 'speaker_SE.png',
  coffeeTable: 'tableCoffee_SE.png',
  television: 'televisionModern_SE.png',
}

const characterFor = (value = '') => {
  let hash = 0
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % CHARACTER_COUNT
}

const frameFor = (character, direction, step = 0) => (
  (character * ROWS_PER_CHARACTER + 1 + step) * FRAMES_PER_ROW + Math.max(0, DIRECTIONS.indexOf(direction))
)

const directionFor = (vx, vy, previous = 'down') => {
  if (vx < 0 && vy < 0) return 'up-left'
  if (vx > 0 && vy < 0) return 'up-right'
  if (vx < 0 && vy > 0) return 'down-left'
  if (vx > 0 && vy > 0) return 'down-right'
  if (vx < 0) return 'left'
  if (vx > 0) return 'right'
  if (vy < 0) return 'up'
  if (vy > 0) return 'down'
  return previous
}

const drawDiamond = (graphics, x, y, width, height, color, alpha = 1) => {
  graphics.fillStyle(color, alpha)
  graphics.fillPoints([
    new Phaser.Geom.Point(x, y - height / 2),
    new Phaser.Geom.Point(x + width / 2, y),
    new Phaser.Geom.Point(x, y + height / 2),
    new Phaser.Geom.Point(x - width / 2, y),
  ], true)
}

// Giữ thế giới lớn hơn viewport để camera có khoảng dịch chuyển theo nhân vật.
const cameraZoomFor = (width) => Math.min(1.4, Math.max(0.85, width / 1350))

export class WorkspaceScene extends Phaser.Scene {
  constructor({ onZoneChange, onInteract, onMove, onReady }) {
    super('WorkspaceScene')
    this.onZoneChange = onZoneChange
    this.onInteract = onInteract
    this.onMove = onMove
    this.onReady = onReady
    this.remotePlayers = new Map()
    this.currentZone = null
    this.lastSentAt = 0
    this.lastSentPosition = { x: 0, y: 0 }
  }

  preload() {
    this.load.spritesheet('workspace-characters', CHARACTER_SHEET, { frameWidth: 16, frameHeight: 24 })
    Object.entries(furnitureAssets).forEach(([key, filename]) => {
      this.load.image(`workspace-${key}`, `${FURNITURE_PATH}/${filename}`)
    })
  }

  create() {
    this.createCharacterAnimations()
    this.createCoreTrailTexture()
    this.physics.world.setBounds(40, 55, WORLD_WIDTH - 80, WORLD_HEIGHT - 100)
    this.cameras.main.setBackgroundColor('#eef7ff')
    this.drawWorld()

    this.solids = this.physics.add.staticGroup()
    this.createFurniture()
    this.createZoneAnimations()

    this.playerCharacter = characterFor(this.game.registry.get('userId'))
    this.player = this.physics.add.sprite(
      WORLD_WIDTH / 2, 680, 'workspace-characters', frameFor(this.playerCharacter, 'down'),
    ).setScale(3)
    this.player.setCollideWorldBounds(true)
    this.player.setDepth(1000)
    this.player.body.setSize(9, 5).setOffset(3.5, 18)
    this.physics.add.collider(this.player, this.solids)

    this.playerName = this.add.text(this.player.x, this.player.y - 47, this.game.registry.get('displayName'), {
      fontFamily: 'monospace', fontSize: '14px', color: '#24324a', stroke: '#ffffff', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(1200)

    this.heldArrows = new Set()
    this.handleWorkspaceKeyDown = (event) => {
      const activeElement = document.activeElement
      if (activeElement && ['INPUT', 'TEXTAREA'].includes(activeElement.tagName)) return

      if ((event.key === 'e' || event.key === 'E' || event.key === 'Enter') && !event.repeat) {
        event.preventDefault()
        this.tryInteract()
        return
      }

      if (!event.key.startsWith('Arrow')) return
      event.preventDefault()
      this.heldArrows.add(event.key)

      // Một cú bấm rất ngắn có thể keydown + keyup giữa hai frame Phaser.
      // Nudge nhỏ này bảo đảm tap phím vẫn tạo chuyển động; giữ phím vẫn mượt
      // nhờ velocity trong update().
      if (!event.repeat && this.player) {
        const nudge = 8
        if (event.key === 'ArrowLeft') this.player.x -= nudge
        if (event.key === 'ArrowRight') this.player.x += nudge
        if (event.key === 'ArrowUp') this.player.y -= nudge * 0.72
        if (event.key === 'ArrowDown') this.player.y += nudge * 0.72
      }
    }
    this.handleArrowUp = (event) => this.heldArrows.delete(event.key)
    this.clearHeldArrows = () => this.heldArrows.clear()
    window.addEventListener('keydown', this.handleWorkspaceKeyDown)
    window.addEventListener('keyup', this.handleArrowUp)
    window.addEventListener('blur', this.clearHeldArrows)

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
    this.cameras.main.setZoom(cameraZoomFor(this.scale.width))
    this.cameras.main.startFollow(this.player, true, 0.14, 0.14)
    // Đặt nhân vật hơi thấp hơn tâm nhìn để vẫn thấy khu vực phía trước.
    this.cameras.main.setFollowOffset(0, 110)

    this.scale.on('resize', (size) => {
      this.cameras.main.setZoom(cameraZoomFor(size.width))
    })

    // Canvas có thể mất focus sau khi người dùng chat hoặc mở modal. Click lại
    // bản đồ sẽ trả focus cho Phaser để bốn phím mũi tên hoạt động ổn định.
    const canvas = this.game.canvas
    canvas.tabIndex = 0
    canvas.setAttribute('aria-label', 'Bản đồ Workspace, di chuyển bằng bốn phím mũi tên')
    canvas.addEventListener('pointerdown', () => canvas.focus())
    canvas.focus()
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', this.handleWorkspaceKeyDown)
      window.removeEventListener('keyup', this.handleArrowUp)
      window.removeEventListener('blur', this.clearHeldArrows)
    })
    this.onReady?.()
  }

  createCharacterAnimations() {
    this.textures.get('workspace-characters').setFilter(Phaser.Textures.FilterMode.NEAREST)
    for (let character = 0; character < CHARACTER_COUNT; character += 1) {
      DIRECTIONS.forEach((direction) => {
        this.anims.create({
          key: `workspace-walk-${character}-${direction}`,
          frames: [0, 1, 2, 1].map((step) => ({
            key: 'workspace-characters', frame: frameFor(character, direction, step),
          })),
          frameRate: 8,
          repeat: -1,
        })
      })
    }
  }

  createCoreTrailTexture() {
    const texture = this.textures.createCanvas('workspace-core-trail', 32, 32)
    const context = texture.getContext()
    const gradient = context.createRadialGradient(16, 16, 1, 16, 16, 16)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.65)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 32, 32)
    texture.refresh()
  }

  emitCoreTrail(core, x, y, trail, time) {
    const previous = trail.position
    if (!previous || !activeCore(core) || core.motionEnabled === false) {
      trail.position = { x, y }
      return
    }
    const distance = Phaser.Math.Distance.Between(previous.x, previous.y, x, y)
    if (distance < 9 || time - (trail.lastAt || 0) < 55) return
    trail.position = { x, y }
    trail.lastAt = time

    const palette = corePalette(core)
    const vivid = core.intensity === 'vivid'
    const trailX = previous.x + (x - previous.x) * 0.35
    const trailY = previous.y + (y - previous.y) * 0.35 + 27
    const glow = this.add.image(trailX, trailY, 'workspace-core-trail')
      .setTint(palette.accent).setAlpha(vivid ? 0.82 : 0.58)
      .setScale(vivid ? 0.82 : 0.64).setDepth(trailY - 12)
    this.tweens.add({
      targets: glow, alpha: 0, scale: 0.12, duration: vivid ? 650 : 500,
      ease: 'Sine.Out', onComplete: () => glow.destroy(),
    })

    if (vivid || Math.random() < 0.45) {
      const spark = this.add.circle(trailX + Phaser.Math.Between(-7, 7), trailY - 3, vivid ? 2.3 : 1.8, 0xffffff, 0.95)
        .setDepth(trailY - 11)
      this.tweens.add({
        targets: spark, y: spark.y - 10, alpha: 0, scale: 0.2,
        duration: 520, ease: 'Sine.Out', onComplete: () => spark.destroy(),
      })
    }
  }

  setCharacterMotion(sprite, character, direction, moving) {
    const facing = DIRECTIONS.includes(direction) ? direction : 'down'
    if (moving) {
      const key = `workspace-walk-${character}-${facing}`
      if (sprite.anims.currentAnim?.key !== key || !sprite.anims.isPlaying) sprite.play(key)
    } else {
      sprite.anims.stop()
      sprite.setFrame(frameFor(character, facing))
    }
  }

  drawWorld() {
    const floor = this.add.graphics()
    for (let y = 55; y < WORLD_HEIGHT; y += 32) {
      for (let x = 0; x < WORLD_WIDTH; x += 64) {
        drawDiamond(floor, x + ((y / 32) % 2) * 32, y, 66, 34, ((x / 64 + y / 32) % 2) ? 0xf8fbff : 0xeaf3fc)
      }
    }
    floor.setDepth(-10)

    const border = this.add.graphics().lineStyle(6, 0xb9cee4, 1)
    border.strokeRoundedRect(45, 55, WORLD_WIDTH - 90, WORLD_HEIGHT - 110, 24)

    for (const zone of ZONES) {
      const left = zone.x - zone.width / 2
      const top = zone.y - zone.height / 2
      const right = left + zone.width
      const bottom = top + zone.height
      const room = this.add.graphics().setDepth(0)

      // Tường sau và sàn gỗ tạo một không gian có chiều sâu; cửa vào mở ở giữa.
      room.fillStyle(0x9ab0c8, 0.2).fillRoundedRect(left + 8, top + 12, zone.width, zone.height, 12)
      room.fillStyle(0xfffdf8).fillRect(left, top, zone.width, zone.height)
      room.fillStyle(zone.color, 0.11).fillRect(left, top, zone.width, 94)
      room.fillStyle(0xf3e9d9).fillRect(left + 8, top + 102, zone.width - 16, zone.height - 110)
      room.lineStyle(1, 0xdccfbd, 0.46)
      for (let y = top + 126; y < bottom - 10; y += 25) {
        room.lineBetween(left + 9, y, right - 9, y)
      }
      for (let x = left + 48; x < right - 9; x += 80) {
        room.lineBetween(x, top + 102, x, bottom - 8)
      }
      room.fillStyle(zone.color, 0.18).fillRect(left, top + 91, zone.width, 11)
      room.fillStyle(0xffffff, 0.6).fillRoundedRect(left + 25, top + 23, 62, 45, 4)
      room.lineStyle(3, zone.color, 0.28).strokeRoundedRect(left + 25, top + 23, 62, 45, 4)
      room.lineBetween(left + 56, top + 24, left + 56, top + 67)
      room.lineBetween(left + 26, top + 46, left + 86, top + 46)
      room.lineStyle(7, zone.color, 0.48)
      room.lineBetween(left, bottom, zone.x - 55, bottom)
      room.lineBetween(zone.x + 55, bottom, right, bottom)
      room.lineStyle(7, zone.color, 0.6)
      room.lineBetween(left, top, right, top)
      room.lineBetween(left, top, left, bottom)
      room.lineBetween(right, top, right, bottom)
      room.lineStyle(2, 0xffffff, 0.9)
      room.lineBetween(zone.x - 55, bottom + 3, zone.x + 55, bottom + 3)

      this.add.text(zone.x, top + 45, zone.label, {
        fontFamily: 'monospace', fontSize: '24px', fontStyle: 'bold', color: '#24324a', stroke: '#ffffff', strokeThickness: 6,
      }).setOrigin(0.5).setDepth(100)
      this.add.text(zone.x, top + 77, zone.hint, {
        fontFamily: 'monospace', fontSize: '15px', color: '#52637a', stroke: '#ffffff', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(100)
    }

    this.add.text(WORLD_WIDTH / 2, 86, 'MUSICQUE SOCIAL WORKSPACE', {
      fontFamily: 'monospace', fontSize: '28px', fontStyle: 'bold', color: '#24324a', stroke: '#ffffff', strokeThickness: 7,
    }).setOrigin(0.5).setDepth(100)

    const tickerTrack = this.add.graphics().setDepth(95)
    tickerTrack.fillStyle(0xffffff, 0.9).fillRoundedRect(390, 105, 820, 30, 15)
    tickerTrack.lineStyle(2, 0xc8d9ea, 1).strokeRoundedRect(390, 105, 820, 30, 15)
    this.nowPlayingText = this.add.text(1220, 120, '', {
      fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: '#52637a',
    }).setOrigin(0, 0.5).setDepth(105)

    const tickerMaskShape = this.make.graphics({ add: false })
    tickerMaskShape.fillStyle(0xffffff).fillRect(402, 106, 796, 28)
    this.nowPlayingText.setMask(tickerMaskShape.createGeometryMask())
  }

  createFurniture() {
    const addRug = (x, y, width, height, color) => {
      const rug = this.add.graphics().setDepth(12)
      drawDiamond(rug, x, y, width, height, color, 0.52)
      rug.lineStyle(2, color, 0.52)
      rug.strokePoints([
        new Phaser.Geom.Point(x, y - height / 2),
        new Phaser.Geom.Point(x + width / 2, y),
        new Phaser.Geom.Point(x, y + height / 2),
        new Phaser.Geom.Point(x - width / 2, y),
      ], true)
    }
    const addDecoration = (key, x, y, scale = 1, depth = y) => (
      this.add.image(x, y, `workspace-${key}`).setScale(scale).setDepth(depth)
    )
    const addSolid = (key, x, y, scale = 1) => {
      const item = this.solids.create(x, y, `workspace-${key}`)
        .setOrigin(0.5, 1)
        .setScale(scale)
        .setDepth(y)
      item.refreshBody()
      item.body.setSize(item.displayWidth * 0.72, Math.min(26, item.displayHeight * 0.26))
      return item
    }

    // Music Club: một góc nghe nhạc thật sự, thay cho các quầy trắng placeholder.
    addRug(300, 480, 188, 96, 0xdacbfa)
    addSolid('sofa', 300, 451, 0.82)
    addSolid('speaker', 190, 462, 0.9)
    addSolid('speaker', 410, 462, 0.9).setFlipX(true)
    addDecoration('coffeeTable', 300, 515, 0.68, 515)
    this.musicRadio = addDecoration('radio', 300, 494, 0.72, 516).setOrigin(0.5, 1)

    // Arcade: hai trạm chơi game có bàn, màn hình và ghế riêng.
    addRug(800, 483, 238, 112, 0xf7c5cf)
    addSolid('desk', 742, 470, 0.86)
    addSolid('desk', 858, 470, 0.86)
    this.arcadeScreens = [
      addDecoration('monitor', 742, 440, 0.7, 471).setOrigin(0.5, 1),
      addDecoration('monitor', 858, 440, 0.7, 471).setOrigin(0.5, 1),
    ]
    addDecoration('chair', 757, 505, 0.72, 505).setOrigin(0.5, 1)
    addDecoration('chair', 873, 505, 0.72, 505).setOrigin(0.5, 1)

    // News Cafe: sofa, bàn đọc, cây xanh và kệ sách tạo cảm giác thư viện nhỏ.
    addRug(1295, 483, 220, 108, 0xc6edf2)
    addSolid('sofa', 1215, 456, 0.78)
    this.newsTable = addDecoration('coffeeTable', 1300, 512, 0.7, 512)
    addSolid('bookcase', 1432, 458, 0.68)
    addDecoration('bookcaseLow', 1365, 462, 0.56, 463).setOrigin(0.5, 1)
  }

  createZoneAnimations() {
    // Music Club — đèn trạng thái nhỏ trên hai loa, không che nội thất.
    [190, 410].forEach((x, index) => {
      const led = this.add.circle(x, 438, 3, 0xc4b5fd, 0.9).setDepth(510)
      this.tweens.add({
        targets: led,
        scale: { from: 0.75, to: 1.4 },
        alpha: { from: 0.45, to: 1 },
        duration: 850 + index * 180,
        delay: index * 240,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      })
    })

    // Arcade — màn hình thở sáng xen kẽ như máy game đang chờ người chơi.
    this.arcadeScreens.forEach((screen, index) => {
      screen.setTint(index ? 0xffd7e2 : 0xdbeafe)
      this.tweens.add({
        targets: screen,
        alpha: { from: 0.72, to: 1 },
        duration: 900 + index * 220,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      })
    })

    // News Cafe — hơi cà phê bay chậm trên bàn đọc.
    ;[0, 1, 2].forEach((index) => {
      const steam = this.add.circle(1292 + index * 7, 490, 3, 0xffffff, 0.72).setDepth(540)
      this.tweens.add({
        targets: steam,
        y: 458,
        x: steam.x + (index % 2 ? 7 : -5),
        alpha: { from: 0.68, to: 0 },
        scale: { from: 0.75, to: 1.65 },
        duration: 1900,
        delay: index * 540,
        repeat: -1,
        ease: 'Sine.Out',
      })
    })
  }

  setNowPlaying(title) {
    if (!this.nowPlayingText) return
    const content = title
      ? `♫  ĐANG PHÁT  •  ${title}`
      : '♫  CHƯA CÓ BÀI ĐANG PHÁT  •  GHÉ MUSIC CLUB ĐỂ MỞ MÀN'
    this.nowPlayingText.setText(content)
    this.nowPlayingText.x = 1220
  }

  update(time, delta) {
    if (!this.player) return
    if (this.nowPlayingText) {
      this.nowPlayingText.x -= delta * 0.075
      if (this.nowPlayingText.x + this.nowPlayingText.width < 402) {
        this.nowPlayingText.x = 1220
      }
    }
    const activeElement = document.activeElement
    const typing = activeElement && ['INPUT', 'TEXTAREA'].includes(activeElement.tagName)
    const speed = typing ? 0 : 220
    let vx = 0
    let vy = 0
    const previousDirection = this.player.getData('direction') || 'down'

    if (this.heldArrows.has('ArrowLeft')) vx = -speed
    else if (this.heldArrows.has('ArrowRight')) vx = speed
    if (this.heldArrows.has('ArrowUp')) vy = -speed * 0.72
    else if (this.heldArrows.has('ArrowDown')) vy = speed * 0.72
    const direction = directionFor(vx, vy, previousDirection)

    this.player.setVelocity(vx, vy)
    if (vx && vy) this.player.body.velocity.normalize().scale(speed)
    this.player.setData('direction', direction)
    this.setCharacterMotion(this.player, this.playerCharacter, direction, Boolean(vx || vy))
    this.player.setDepth(this.player.y + 40)
    if (!this.ownTrail) this.ownTrail = { position: { x: this.player.x, y: this.player.y }, lastAt: 0 }
    this.emitCoreTrail(this.selfCore, this.player.x, this.player.y, this.ownTrail, time)
    this.playerName.setPosition(this.player.x, this.player.y - 47).setDepth(this.player.y + 80)
    if (this.ownBubble?.active) {
      this.ownBubble.setPosition(this.player.x, this.player.y - 88).setDepth(this.player.y + 100)
    }
    for (const remote of this.remotePlayers.values()) {
      if (remote.lastMovedAt && time - remote.lastMovedAt > 160) {
        remote.sprite.anims.stop()
        remote.sprite.setFrame(frameFor(remote.character, remote.direction || 'down'))
        remote.lastMovedAt = 0
      }
    }

    const zone = ZONES.find((item) => Phaser.Geom.Rectangle.Contains(
      new Phaser.Geom.Rectangle(item.x - item.width / 2, item.y - item.height / 2, item.width, item.height),
      this.player.x,
      this.player.y,
    ))
    const zoneId = zone?.id || null
    if (zoneId !== this.currentZone) {
      this.currentZone = zoneId
      this.onZoneChange(zone || null)
    }

    const moved = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.lastSentPosition.x, this.lastSentPosition.y) > 3
    if (moved && time - this.lastSentAt > 80) {
      this.lastSentAt = time
      this.lastSentPosition = { x: this.player.x, y: this.player.y }
      this.onMove({ x: this.player.x, y: this.player.y, direction })
    }
  }

  tryInteract() {
    if (this.currentZone) this.onInteract(this.currentZone)
  }

  setMembers(members, selfId) {
    const activeIds = new Set()
    members.forEach((member) => {
      if (member.socketId === selfId) {
        this.player?.setPosition(member.x, member.y)
        this.selfCore = member.core
        this.ownTrail = { position: { x: member.x, y: member.y }, lastAt: 0 }
        return
      }
      activeIds.add(member.socketId)
      this.upsertRemote(member)
    })
    for (const socketId of this.remotePlayers.keys()) {
      if (!activeIds.has(socketId)) this.removeRemote(socketId)
    }
  }

  upsertRemote(member) {
    let remote = this.remotePlayers.get(member.socketId)
    if (!remote) {
      const character = characterFor(member.userId)
      const sprite = this.add.sprite(
        member.x, member.y, 'workspace-characters', frameFor(character, member.direction || 'down'),
      ).setScale(3)
      const label = this.add.text(member.x, member.y - 47, member.displayName, {
        fontFamily: 'monospace', fontSize: '14px', color: '#24324a', stroke: '#ffffff', strokeThickness: 5,
      }).setOrigin(0.5)
      remote = {
        sprite, label, character, direction: member.direction || 'down',
        lastPosition: { x: member.x, y: member.y }, lastMovedAt: 0,
        core: member.core, trail: { position: { x: member.x, y: member.y }, lastAt: 0 },
        bubble: null, bubbleTimer: null,
      }
      this.remotePlayers.set(member.socketId, remote)
    }
    const moved = Phaser.Math.Distance.Between(remote.lastPosition.x, remote.lastPosition.y, member.x, member.y) > 1
    if (moved) remote.lastMovedAt = this.time.now
    remote.core = member.core
    if (moved) this.emitCoreTrail(remote.core, member.x, member.y, remote.trail, this.time.now)
    remote.lastPosition = { x: member.x, y: member.y }
    remote.direction = member.direction || 'down'
    this.setCharacterMotion(remote.sprite, remote.character, member.direction, moved)
    remote.sprite.setPosition(member.x, member.y).setDepth(member.y + 40)
    remote.label.setPosition(member.x, member.y - 47).setDepth(member.y + 80)
    if (remote.bubble) remote.bubble.setPosition(member.x, member.y - 88).setDepth(member.y + 100)
  }

  removeRemote(socketId) {
    const remote = this.remotePlayers.get(socketId)
    if (!remote) return
    remote.sprite.destroy()
    remote.label.destroy()
    remote.bubble?.destroy()
    if (remote.bubbleTimer) remote.bubbleTimer.remove()
    this.remotePlayers.delete(socketId)
  }

  createCoreBubble(message, x, y, depth) {
    const palette = corePalette(message.core)
    const body = this.add.text(0, 0, message.content, {
      fontFamily: 'system-ui', fontSize: '14px', color: '#24324a',
      wordWrap: { width: 208 }, align: 'center', lineSpacing: 3,
    }).setOrigin(0.5, 0)
    const width = Math.max(112, Math.min(236, body.width + 28))
    const height = body.height + 43
    const halo = this.add.graphics()
    halo.fillStyle(palette.glow, 0.3)
    halo.fillRoundedRect(-width / 2 - 5, -height - 5, width + 10, height + 10, 13)
    halo.setAlpha(message.core.intensity === 'vivid' ? 0.85 : 0.55)

    const frame = this.add.graphics()
    frame.fillStyle(0x71819b, 0.13)
    frame.fillRoundedRect(-width / 2 + 2, -height + 4, width, height, 10)
    frame.fillStyle(0xffffff, 1)
    frame.fillRoundedRect(-width / 2, -height, width, height, 10)
    frame.lineStyle(2, palette.accent, 1)
    frame.strokeRoundedRect(-width / 2, -height, width, height, 10)
    frame.fillStyle(palette.accent, 0.13)
    frame.fillRoundedRect(-width / 2 + 4, -height + 4, width - 8, 21, 6)
    frame.fillStyle(palette.accent, 1)
    frame.fillRect(-width / 2 + 10, -height + 29, width - 20, 2)

    const badge = this.add.text(0, -height + 7, '✦  CORE', {
      fontFamily: 'system-ui', fontSize: '11px', fontStyle: 'bold',
      color: palette.ink, letterSpacing: 1,
    }).setOrigin(0.5, 0)
    body.setPosition(0, -height + 35)

    const bubble = this.add.container(x, y, [halo, frame, badge, body]).setDepth(depth)
    if (message.core.motionEnabled !== false) {
      this.tweens.add({
        targets: halo,
        alpha: message.core.intensity === 'vivid' ? { from: 0.45, to: 1 } : { from: 0.25, to: 0.65 },
        duration: 1100,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      })
      bubble.once('destroy', () => this.tweens.killTweensOf(halo))
    }
    return bubble
  }

  showBubble(message, selfId) {
    const ownMessage = message.socketId === selfId
    const target = ownMessage
      ? { sprite: this.player, label: this.playerName, bubble: this.ownBubble, bubbleTimer: this.ownBubbleTimer }
      : this.remotePlayers.get(message.socketId)
    if (!target?.sprite) return
    target.bubble?.destroy()
    target.bubbleTimer?.remove()
    const bubble = activeCore(message.core)
      ? this.createCoreBubble(message, target.sprite.x, target.sprite.y - 88, target.sprite.y + 100)
      : this.add.text(target.sprite.x, target.sprite.y - 88, message.content, {
        fontFamily: 'system-ui', fontSize: '14px', color: '#111827', backgroundColor: '#ffffff',
        padding: { x: 10, y: 7 }, wordWrap: { width: 220 }, align: 'center',
      }).setOrigin(0.5, 1).setDepth(target.sprite.y + 100)
    const timer = this.time.delayedCall(7000, () => {
      bubble.destroy()
      if (ownMessage) {
        this.ownBubble = null
        this.ownBubbleTimer = null
      } else {
        target.bubble = null
        target.bubbleTimer = null
      }
    })
    if (ownMessage) {
      this.ownBubble = bubble
      this.ownBubbleTimer = timer
    } else {
      target.bubble = bubble
      target.bubbleTimer = timer
    }
  }
}
