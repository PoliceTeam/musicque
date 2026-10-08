import * as THREE from 'three'
import atlas from './ui_atlas.json'
import { FRAME } from './auditionConfig'

// Vẽ bảng thông số cuối bài lên canvas 2D rồi dùng làm texture trong scene WebGL (không phải HTML).
// Chữ số, chữ chấm điểm và nhãn combo lấy thẳng từ atlas UI để cùng phong cách với HUD lúc chơi.

// Chỗ đứng theo hạng ở bảng điểm cuối bài: [x, z, độ cao bục]. Hạng 1 giữa và trước nhất,
// hạng 2 bên trái, đều đứng trên bục; từ hạng 3 đứng dưới sàn phía sau.
export const RANK_SLOTS = [
  [0, 0.5, 0.55],
  [-1.7, 0.3, 0.32],
  [1.7, -0.5, 0],
  [-3.2, -0.7, 0],
  [3.2, -0.7, 0],
  [4.6, -0.9, 0]
]
export const slotOf = (rank) => RANK_SLOTS[Math.min(Math.max(rank, 1), RANK_SLOTS.length) - 1]

const ATLAS_URL = '/audition/atlas/ui_atlas.png'
let atlasImage = null
const atlasWaiters = new Set()

// Ảnh atlas dùng chung cho mọi bảng; bảng nào vẽ trước khi ảnh tải xong sẽ được vẽ lại.
export const loadAtlasImage = (onReady) => {
  if (atlasImage?.complete && atlasImage.naturalWidth) return atlasImage
  atlasWaiters.add(onReady)
  if (!atlasImage) {
    atlasImage = new Image()
    atlasImage.onload = () => {
      for (const fn of atlasWaiters) fn()
      atlasWaiters.clear()
    }
    atlasImage.src = ATLAS_URL
  }
  return null
}

const drawFrame = (ctx, img, name, x, y, h, { align = 'left' } = {}) => {
  const f = atlas.frames[name]?.frame
  if (!f || !img) return 0
  const w = (f.w * h) / f.h
  const dx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
  ctx.drawImage(img, f.x, f.y, f.w, f.h, dx, y, w, h)
  return w
}

// Chữ số atlas có lề trong suốt rộng (128×160) — kéo sát lại như HUD.
const drawDigits = (ctx, img, value, cx, y, h) => {
  const s = String(Math.max(0, Math.floor(value)))
  const f = atlas.frames[FRAME.digit('0')].frame
  const w = (f.w * h) / f.h
  const step = w * 0.56
  const total = step * (s.length - 1) + w
  let x = cx - total / 2
  for (const d of s) {
    drawFrame(ctx, img, FRAME.digit(d), x, y, h)
    x += step
  }
}

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const fitText = (ctx, text, maxWidth) => {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t}…`
}

export const fontFamily = () =>
  (typeof document !== 'undefined' && getComputedStyle(document.body).fontFamily) || 'system-ui, sans-serif'

export const TIER = {
  1: { label: 'VÔ ĐỊCH', border: '#ffd84d', glow: 'rgba(255, 200, 40, 0.9)', top: '#5a3d00', bottom: '#1d1300', accent: '#ffe27a' },
  2: { label: 'Á QUÂN', border: '#e3ebf5', glow: 'rgba(210, 225, 245, 0.8)', top: '#3a4452', bottom: '#11151b', accent: '#f2f6fb' },
  rest: { label: '', border: 'rgba(160, 150, 220, 0.35)', glow: null, top: 'rgba(30, 20, 64, 0.92)', bottom: 'rgba(10, 6, 28, 0.92)', accent: '#b9b2e6' }
}

const ROWS = [
  ['perfect', 'perfect_text'],
  ['great', 'great_text'],
  ['cool', 'cool_text'],
  ['bad', 'bad_text'],
  ['missed', 'missed_text']
]

// entry: { rank, name, score, counts, maxPerfect, isMe, isBot }
export const drawBoard = (canvas, entry, img) => {
  const ctx = canvas.getContext('2d')
  const W = canvas.width
  const H = canvas.height
  const u = W / 240 // đơn vị thiết kế: bảng rộng 240
  const tier = TIER[entry.rank] || TIER.rest
  const font = fontFamily()
  ctx.clearRect(0, 0, W, H)

  // nền + viền (hạng 1–2 có viền phát sáng)
  const pad = 10 * u
  if (tier.glow) {
    ctx.save()
    ctx.shadowColor = tier.glow
    ctx.shadowBlur = 16 * u
    roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 18 * u)
    ctx.fillStyle = tier.bottom
    ctx.fill()
    ctx.restore()
  }
  const g = ctx.createLinearGradient(0, pad, 0, H - pad)
  g.addColorStop(0, tier.top)
  g.addColorStop(1, tier.bottom)
  roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 18 * u)
  ctx.fillStyle = g
  ctx.fill()
  ctx.lineWidth = (entry.rank <= 2 ? 4 : 2) * u
  ctx.strokeStyle = tier.border
  ctx.stroke()
  if (entry.isMe) {
    ctx.lineWidth = 2 * u
    ctx.strokeStyle = '#2fe0ff'
    roundRect(ctx, pad + 5 * u, pad + 5 * u, W - (pad + 5 * u) * 2, H - (pad + 5 * u) * 2, 14 * u)
    ctx.stroke()
  }

  // hạng (số thứ tự) + nhãn Vô địch / Á quân
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = tier.accent
  ctx.font = `italic 900 ${46 * u}px ${font}`
  const rankText = `#${entry.rank}`
  ctx.fillText(rankText, 24 * u, 66 * u)
  const rankW = ctx.measureText(rankText).width
  if (tier.label) {
    ctx.font = `900 ${13 * u}px ${font}`
    ctx.fillStyle = tier.border
    ctx.fillText(`${entry.rank === 1 ? '♛ ' : ''}${tier.label}`, 32 * u + rankW, 56 * u)
  }
  // tên: dòng riêng, đủ rộng cả bảng (đứng cạnh số hạng thì tên dài bị cắt cụt)
  const tag = entry.isMe ? ' (Bạn)' : entry.isBot ? ' · Bot' : ''
  ctx.font = `800 ${17 * u}px ${font}`
  const tagW = tag ? ctx.measureText(tag).width : 0
  ctx.fillStyle = '#ffffff'
  ctx.fillText(fitText(ctx, entry.name, W - 52 * u - tagW), 24 * u, 92 * u)
  if (tag) {
    ctx.fillStyle = entry.isMe ? '#2fe0ff' : 'rgba(255,255,255,0.55)'
    ctx.fillText(tag, 24 * u + ctx.measureText(fitText(ctx, entry.name, W - 52 * u - tagW)).width, 92 * u)
  }

  // tổng điểm
  ctx.textAlign = 'center'
  ctx.font = `800 ${11 * u}px ${font}`
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillText('TỔNG ĐIỂM', W / 2, 118 * u)
  drawDigits(ctx, img, entry.score, W / 2, 122 * u, 44 * u)

  // Perfect / Great / Cool / Bad / Missed
  let y = 176 * u
  const rowH = 27 * u
  ctx.textAlign = 'right'
  for (const [key, frame] of ROWS) {
    drawFrame(ctx, img, `judgements/${frame}`, 22 * u, y, rowH * 0.95)
    ctx.font = `900 ${19 * u}px ${font}`
    ctx.fillStyle = '#ffffff'
    ctx.fillText(String(entry.counts?.[key] ?? 0), W - 28 * u, y + rowH * 0.78)
    y += rowH
  }

  // dây Perfect liên tiếp dài nhất
  y += 6 * u
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 1 * u
  ctx.beginPath()
  ctx.moveTo(24 * u, y)
  ctx.lineTo(W - 24 * u, y)
  ctx.stroke()
  y += 8 * u
  ctx.textAlign = 'left'
  ctx.font = `800 ${11 * u}px ${font}`
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.fillText('DÂY PERFECT DÀI NHẤT', 24 * u, y + 12 * u)
  y += 18 * u
  const n = entry.maxPerfect || 0
  const pw = drawFrame(ctx, img, 'judgements/perfect_text', 22 * u, y, 26 * u)
  if (n > 0 && n <= 20) {
    drawFrame(ctx, img, FRAME.combo(n), 30 * u + pw, y + 1 * u, 24 * u)
  } else {
    ctx.font = `900 ${20 * u}px ${font}`
    ctx.fillStyle = n > 0 ? '#ffd84d' : 'rgba(255,255,255,0.5)'
    ctx.fillText(n > 0 ? `x${n}` : '—', 32 * u + pw, y + 21 * u)
  }
}

export const BOARD_ASPECT = 398 / 240 // cao / rộng — đủ chỗ cho dòng tên riêng và dây Perfect ở đáy

export const makeTexture = (canvas) => {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
