import { useEffect, useRef } from 'react'
import Phaser from 'phaser'

const COLORS = [0xed7884, 0x729ce8, 0xefb344, 0x60bf91]
const SYMBOLS = ['●', '◆', '▲', '■']
class TaskScene extends Phaser.Scene {
  constructor(challenge, callbacks) {
    super('shift-task'); this.challenge = challenge; this.callbacks = callbacks
    this.enabled = true; this.links = {}; this.code = ''; this.switches = new Set()
  }
  text(x, y, value, size = 20, color = '#e7f3fa') {
    return this.add.text(x, y, value, { fontFamily: 'Arial', fontSize: `${size}px`, color }).setOrigin(0.5)
  }
  button(x, y, width, label, action, color = 0x26485f) {
    const box = this.add.rectangle(x, y, width, 44, color).setStrokeStyle(2, 0x61879c).setInteractive({ useHandCursor: true })
    const text = this.text(x, y, label)
    box.on('pointerover', () => box.setAlpha(0.8)).on('pointerout', () => box.setAlpha(1))
    box.on('pointerdown', () => { if (this.enabled) action(box, text) })
    return box
  }
  create() {
    this.add.rectangle(280, 180, 560, 360, 0x142b3e)
    this.add.rectangle(280, 180, 538, 338).setStrokeStyle(2, 0x426378)
    if (this.challenge.kind === 'wiring') this.createWiring()
    if (this.challenge.kind === 'code') this.createCode()
    if (this.challenge.kind === 'restart') this.createRestart()
    if (this.challenge.kind === 'navigation') this.createNavigation()
    if (['fuel', 'garbage'].includes(this.challenge.kind)) this.createHoldTask()
  }
  createNavigation() {
    this.text(280, 32, 'KÉO TÂM NGẮM VỀ ĐÍCH', 20)
    this.add.circle(280, 190, 30).setStrokeStyle(3, 0x60bf91)
    const cursor = this.add.container(130, 110, [this.add.rectangle(0, 0, 44, 3, 0xefb344), this.add.rectangle(0, 0, 3, 44, 0xefb344)])
    cursor.setSize(50, 50).setInteractive({ draggable: true, useHandCursor: true })
    this.input.on('drag', (pointer, object, x, y) => {
      if (!this.enabled || this.finished) return
      object.setPosition(Phaser.Math.Clamp(x, 60, 500), Phaser.Math.Clamp(y, 70, 300))
    })
    this.input.on('dragend', () => {
      if (!this.enabled || this.finished || Math.hypot(cursor.x - 280, cursor.y - 190) > 20) return
      this.finished = true; cursor.setPosition(280, 190); this.callbacks.answer(true)
      this.text(280, 310, 'HƯỚNG ĐÃ ỔN ĐỊNH', 18, '#60bf91')
    })
  }
  createHoldTask() {
    const fuel = this.challenge.kind === 'fuel'
    this.text(280, 32, fuel ? 'NẠP NHIÊN LIỆU' : 'XẢ RÁC', 22)
    this.add.rectangle(280, 170, 150, 190, 0x091c2b).setStrokeStyle(3, 0x61879c)
    this.fill = this.add.rectangle(280, 260, 138, fuel ? 1 : 180, fuel ? 0xefb344 : 0x82929d).setOrigin(0.5, 1)
    this.holdProgress = 0
    const button = this.button(280, 310, 230, fuel ? 'GIỮ ĐỂ NẠP' : 'GIỮ CẦN XẢ', () => { this.holding = true })
    button.on('pointerup', () => { this.holding = false })
    button.on('pointerout', () => { this.holding = false })
    this.input.on('pointerup', () => { this.holding = false })
    this.input.on('gameout', () => { this.holding = false })
  }
  createWiring() {
    this.text(280, 30, 'KÉO DÂY ĐẾN ĐẦU CÙNG MÀU / KÝ HIỆU', 16)
    this.lines = this.add.graphics()
    this.preview = this.add.graphics()
    this.ends = this.challenge.order.map((color, index) => ({ color, x: 470, y: 90 + index * 65 }))
    this.ends.forEach(({ color, x, y }) => {
      this.add.circle(x, y, 19, COLORS[color]).setStrokeStyle(3, 0xe7f3fa)
      this.text(x, y, SYMBOLS[color], 19, '#142b3e')
    })
    COLORS.forEach((color, index) => {
      const y = 90 + index * 65
      const start = this.add.circle(90, y, 19, color).setStrokeStyle(3, 0xe7f3fa).setInteractive({ useHandCursor: true })
      this.text(90, y, SYMBOLS[index], 19, '#142b3e')
      start.on('pointerdown', () => {
        if (this.enabled && !Object.hasOwn(this.links, index)) this.dragging = index
      })
    })
    this.input.on('pointermove', (pointer) => {
      if (this.dragging === undefined) return
      this.preview.clear().lineStyle(8, COLORS[this.dragging], 0.8)
        .lineBetween(90, 90 + this.dragging * 65, pointer.x, pointer.y)
    })
    this.input.on('pointerup', (pointer) => {
      const color = this.dragging
      this.dragging = undefined; this.preview.clear()
      if (color === undefined || !this.enabled) return
      const index = this.ends.findIndex((end) => Math.hypot(pointer.x - end.x, pointer.y - end.y) < 30)
      if (index < 0 || this.ends[index].color !== color) {
        this.callbacks.message('Hãy kéo dây đến đầu có cùng màu và ký hiệu.'); return
      }
      this.links[color] = index
      this.lines.lineStyle(8, COLORS[color]).lineBetween(90, 90 + color * 65, 470, this.ends[index].y)
      const glow = this.add.circle(470, this.ends[index].y, 25).setStrokeStyle(3, COLORS[color])
      this.tweens.add({ targets: glow, alpha: 0, scale: 1.8, duration: 450, onComplete: () => glow.destroy() })
      this.callbacks.message('')
      if (Object.keys(this.links).length === 4) this.callbacks.answer([0, 1, 2, 3].map((i) => this.links[i]))
    })
    this.input.on('gameout', () => { this.dragging = undefined; this.preview.clear() })
  }
  createCode() {
    this.text(280, 32, `MÃ THIẾT BỊ: ${this.challenge.code}`, 23, '#efb344')
    this.add.rectangle(280, 85, 290, 56, 0x091c2b).setStrokeStyle(2, 0x60bf91)
    this.display = this.text(280, 85, '— — — —', 29, '#77ded4')
    const enter = (value) => {
      if (value === '⌫') this.code = this.code.slice(0, -1)
      else if (value === 'C') this.code = ''
      else if (this.code.length < 4) this.code += value
      this.display.setText(this.code.padEnd(4, '—').split('').join(' '))
      this.callbacks.answer(this.code)
    }
    ;['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].forEach((value, i) => {
      this.button(190 + i % 3 * 90, 145 + Math.floor(i / 3) * 55, 76, value, () => enter(value))
    })
    this.input.keyboard.on('keydown', (event) => {
      if (!this.enabled) return
      if (/^[0-9]$/.test(event.key)) enter(event.key)
      if (event.key === 'Backspace') { event.preventDefault(); enter('⌫') }
    })
    this.game.canvas.tabIndex = 0
    this.input.on('pointerdown', () => this.game.canvas.focus())
  }
  createRestart() {
    this.text(280, 32, 'BẬT 3 CẦU DAO RỒI KHỞI ĐỘNG', 19)
    for (let i = 0; i < 3; i++) {
      const x = 170 + i * 110
      this.add.rectangle(x, 135, 46, 80, 0x091c2b).setStrokeStyle(2, 0x61879c)
      const lever = this.add.rectangle(x, 158, 62, 22, 0xed7884).setInteractive({ useHandCursor: true })
      this.text(x, 196, `0${i + 1}`, 15)
      lever.on('pointerdown', () => {
        if (!this.enabled || this.bootAt) return
        const on = !this.switches.has(i)
        if (on) this.switches.add(i); else this.switches.delete(i)
        lever.setFillStyle(on ? 0x60bf91 : 0xed7884)
        this.tweens.add({ targets: lever, y: on ? 112 : 158, duration: 180 })
      })
    }
    this.bootLabel = this.text(280, 235, 'THIẾT BỊ CHƯA CÓ ĐIỆN', 16, '#efb344')
    this.add.rectangle(280, 269, 360, 16, 0x091c2b)
    this.progress = this.add.rectangle(100, 269, 1, 12, 0x60bf91).setOrigin(0, 0.5)
    this.button(280, 315, 210, 'KHỞI ĐỘNG', () => {
      if (this.switches.size !== 3) { this.callbacks.message('Cần bật đủ 3 cầu dao.'); return }
      if (this.bootAt) return
      this.bootAt = this.time.now; this.callbacks.message(''); this.bootLabel.setText('ĐANG KHỞI ĐỘNG…')
    })
  }
  update(time, delta) {
    if (this.holding && this.enabled && !this.finished) {
      this.holdProgress = Math.min(1, this.holdProgress + Math.min(delta, 100) / 3000)
      this.fill.height = Math.max(1, 180 * (this.challenge.kind === 'fuel' ? this.holdProgress : 1 - this.holdProgress))
      if (this.holdProgress === 1) { this.finished = true; this.callbacks.answer(true); this.text(280, 60, 'HOÀN TẤT', 18, '#60bf91') }
    }
    if (!this.bootAt || this.finished) return
    const progress = Math.min(1, (time - this.bootAt) / 3000)
    this.progress.width = 360 * progress
    this.bootLabel.setText(`ĐANG KHỞI ĐỘNG… ${Math.floor(progress * 100)}%`)
    if (progress === 1) {
      this.finished = true; this.bootLabel.setText('THIẾT BỊ HOẠT ĐỘNG').setColor('#60bf91')
      this.callbacks.answer(true)
    }
  }
}

const TaskGame = ({ challenge, enabled, onAnswer, onMessage }) => {
  const host = useRef(null); const scene = useRef(null)
  const latest = useRef({ onAnswer, onMessage, enabled, challenge })
  latest.current = { onAnswer, onMessage, enabled, challenge }
  useEffect(() => {
    const current = new TaskScene(latest.current.challenge, {
      answer: (answer) => latest.current.onAnswer(answer), message: (message) => latest.current.onMessage(message),
    })
    scene.current = current
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: host.current, width: 560, height: 360,
      scene: current, backgroundColor: '#142b3e',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      callbacks: { postBoot: () => { current.enabled = latest.current.enabled } },
    })
    return () => { scene.current = null; game.destroy(true) }
  }, [challenge.id])
  useEffect(() => { if (scene.current) scene.current.enabled = enabled }, [enabled])
  return <div className='shift-task-game' ref={host} role='img'
    aria-label={challenge.kind === 'wiring' ? 'Kéo nối bốn dây cùng màu và ký hiệu' : challenge.kind === 'code' ? 'Bàn phím nhập mã thiết bị' : ({ restart: 'Bật ba cầu dao và khởi động thiết bị', navigation: 'Kéo tâm ngắm về đích', garbage: 'Giữ cần gạt để xả rác', fuel: 'Giữ nút để nạp nhiên liệu' })[challenge.kind]} />
}
export default TaskGame
