import React, { useEffect, useMemo, useState } from 'react'
import { fontFamily, makeTexture } from './resultBoard'

// Bộ UI nhỏ vẽ trong scene WebGL (lớp Hud, camera trực giao, đơn vị = pixel, gốc ở giữa màn hình).
// Mỗi thành phần là một mặt phẳng mang canvas texture; bấm/hover qua sự kiện pointer của r3f.
// Canvas vẽ gấp đôi kích thước hiển thị cho chữ sắc nét.

const SCALE = 2

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

const C = {
  ink: '#f3f0ff',
  dim: 'rgba(243, 240, 255, 0.6)',
  cyan: '#2fe0ff',
  pink: '#ff3fd0',
  gold: '#ffd84d',
  green: '#4dffc3',
  red: '#ff6b84',
  panel: 'rgba(10, 6, 30, 0.84)',
  line: 'rgba(255, 255, 255, 0.14)'
}

// Mặt phẳng có canvas texture. draw(ctx, w, h, state) vẽ theo đơn vị hiển thị (đã nhân SCALE sẵn).
const Surface = ({ x, y, w, h, draw, deps, onClick, disabled, z = 0 }) => {
  const [hover, setHover] = useState(false)
  const canvas = useMemo(() => document.createElement('canvas'), [])
  const tex = useMemo(() => makeTexture(canvas), [canvas])
  useEffect(() => () => tex.dispose(), [tex])
  useEffect(() => {
    canvas.width = Math.max(2, Math.round(w * SCALE))
    canvas.height = Math.max(2, Math.round(h * SCALE))
    const ctx = canvas.getContext('2d')
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)
    ctx.clearRect(0, 0, w, h)
    draw(ctx, w, h, { hover: hover && !disabled, disabled })
    tex.needsUpdate = true
  }, [w, h, hover, disabled, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps
  const interactive = Boolean(onClick) && !disabled
  useEffect(() => () => { if (interactive) document.body.style.cursor = '' }, [interactive])
  return (
    <mesh
      position={[x, y, z]}
      onClick={interactive ? (e) => { e.stopPropagation(); onClick() } : undefined}
      onPointerOver={onClick ? (e) => { e.stopPropagation(); setHover(true); if (interactive) document.body.style.cursor = 'pointer' } : undefined}
      onPointerOut={onClick ? () => { setHover(false); document.body.style.cursor = '' } : undefined}
    >
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  )
}

// (x, y) của mọi thành phần là góc trên trái — đổi sang tâm cho mặt phẳng.
const at = (x, y, w, h) => ({ x: x + w / 2, y: y - h / 2 })

export const Panel = ({ x, y, w, h }) => (
  <Surface
    {...at(x, y, w, h)} w={w} h={h} z={-1} deps={[]}
    draw={(ctx, W, H) => {
      ctx.save()
      ctx.shadowColor = 'rgba(255, 63, 208, 0.35)'
      ctx.shadowBlur = 24
      roundRect(ctx, 8, 8, W - 16, H - 16, 16)
      ctx.fillStyle = C.panel
      ctx.fill()
      ctx.restore()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = 'rgba(47, 224, 255, 0.4)'
      roundRect(ctx, 8, 8, W - 16, H - 16, 16)
      ctx.stroke()
    }}
  />
)

// shrink: chữ dài thì thu nhỏ cỡ chữ (tới minSize) cho vừa ô trước khi phải cắt "…".
export const Text = ({ x, y, w, h, text, size = 14, weight = 600, color = C.ink, align = 'left', italic = false, gradient = false, shrink = false, minSize = 10 }) => (
  <Surface
    {...at(x, y, w, h)} w={w} h={h} deps={[text, size, weight, color, align, italic, gradient, shrink, minSize]}
    draw={(ctx, W, H) => {
      let px = size
      const font = () => `${italic ? 'italic ' : ''}${weight} ${px}px ${fontFamily()}`
      ctx.font = font()
      while (shrink && px > minSize && ctx.measureText(text).width > W) {
        px -= 0.5
        ctx.font = font()
      }
      ctx.textBaseline = 'middle'
      ctx.textAlign = align
      if (gradient) {
        const g = ctx.createLinearGradient(0, 0, W, 0)
        g.addColorStop(0, C.cyan)
        g.addColorStop(1, C.pink)
        ctx.fillStyle = g
      } else {
        ctx.fillStyle = color
      }
      const tx = align === 'center' ? W / 2 : align === 'right' ? W : 0
      ctx.fillText(fitText(ctx, text, W), tx, H / 2 + 1)
    }}
  />
)

const BUTTON = {
  primary: { fill: ['#2fe0ff', '#ff3fd0'], text: '#12051f', border: null },
  ready: { fill: ['#4dffc3', '#2fe0ff'], text: '#05261c', border: null },
  ghost: { fill: null, text: C.ink, border: 'rgba(255,255,255,0.25)' },
  soft: { fill: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.06)'], text: C.ink, border: 'rgba(255,255,255,0.16)' },
  active: { fill: ['rgba(47,224,255,0.35)', 'rgba(47,224,255,0.2)'], text: '#ffffff', border: C.cyan }
}

export const Button = ({ x, y, w, h, label, variant = 'soft', disabled = false, onClick, size = 14, radius }) => (
  <Surface
    {...at(x, y, w, h)} w={w} h={h} onClick={onClick} disabled={disabled} deps={[label, variant, size, radius]}
    draw={(ctx, W, H, { hover }) => {
      const s = BUTTON[variant] || BUTTON.soft
      const r = radius ?? Math.min(12, H / 2)
      ctx.globalAlpha = disabled ? 0.4 : 1
      roundRect(ctx, 1.5, 1.5, W - 3, H - 3, r)
      if (s.fill) {
        const g = ctx.createLinearGradient(0, 0, W, 0)
        g.addColorStop(0, s.fill[0])
        g.addColorStop(1, s.fill[1])
        ctx.fillStyle = g
        ctx.fill()
      }
      if (hover) {
        ctx.fillStyle = 'rgba(255,255,255,0.14)'
        ctx.fill()
      }
      if (s.border || hover) {
        ctx.lineWidth = 1.5
        ctx.strokeStyle = hover ? '#ffffff' : s.border
        ctx.stroke()
      }
      ctx.font = `800 ${size}px ${fontFamily()}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = s.text
      ctx.fillText(fitText(ctx, label, W - 12), W / 2, H / 2 + 1)
    }}
  />
)

// Nhãn bên trái + "◀ giá trị ▶" bên phải (thay cho ô chọn / thanh trượt HTML).
export const Stepper = ({ x, y, w, h = 30, label, value, onPrev, onNext, disabled = false, labelW = 96 }) => {
  const bw = h
  const vx = x + labelW
  const vw = w - labelW - bw * 2 - 8
  return (
    <>
      <Text x={x} y={y} w={labelW - 6} h={h} text={label} size={13} color={C.dim} />
      <Button x={vx} y={y} w={bw} h={h} label='◀' onClick={onPrev} disabled={disabled} size={12} />
      <Text x={vx + bw + 4} y={y} w={vw} h={h} text={value} size={14} weight={700} align='center' color={disabled ? C.dim : C.ink} shrink minSize={9} />
      <Button x={vx + bw + 8 + vw} y={y} w={bw} h={h} label='▶' onClick={onNext} disabled={disabled} size={12} />
    </>
  )
}

export const Toggle = ({ x, y, w, h = 30, label, hint, on, disabled = false, onClick }) => (
  <Surface
    {...at(x, y, w, h)} w={w} h={h} onClick={onClick} disabled={disabled} deps={[label, hint, on]}
    draw={(ctx, W, H, { hover }) => {
      const sw = 40
      const sh = 20
      const sy = (H - sh) / 2
      ctx.globalAlpha = disabled ? 0.65 : 1
      roundRect(ctx, 0, sy, sw, sh, sh / 2)
      ctx.fillStyle = on ? C.cyan : 'rgba(255,255,255,0.18)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(on ? sw - sh / 2 : sh / 2, sy + sh / 2, sh / 2 - 3, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.font = `700 14px ${fontFamily()}`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.fillStyle = hover ? '#ffffff' : C.ink
      ctx.fillText(label, sw + 10, H / 2 - (hint ? 6 : 0))
      if (hint) {
        ctx.font = `500 11px ${fontFamily()}`
        ctx.fillStyle = C.dim
        ctx.fillText(fitText(ctx, hint, W - sw - 14), sw + 10, H / 2 + 9)
      }
    }}
  />
)

// Ô người chơi trong phòng chờ.
export const PlayerSlot = ({ x, y, w, h, player, isMe, isHost, ready, empty }) => (
  <Surface
    {...at(x, y, w, h)} w={w} h={h} deps={[player?.name, player?.charNo, isMe, isHost, ready, empty, player?.skill]}
    draw={(ctx, W, H) => {
      roundRect(ctx, 1, 1, W - 2, H - 2, 8)
      if (empty) {
        ctx.setLineDash([4, 4])
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'
        ctx.stroke()
        ctx.setLineDash([])
        ctx.font = `600 12px ${fontFamily()}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.fillText('Chỗ trống', W / 2, H / 2)
        return
      }
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = isMe ? C.cyan : 'rgba(255,255,255,0.1)'
      ctx.stroke()
      // số nhân vật
      roundRect(ctx, 7, (H - 20) / 2, 20, 20, 5)
      ctx.fillStyle = 'rgba(47,224,255,0.2)'
      ctx.fill()
      const font = fontFamily()
      ctx.font = `900 11px ${font}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = C.cyan
      ctx.fillText(String(player.charNo), 17, H / 2 + 1)
      // trạng thái bên phải
      const tag = isHost ? ['Chủ phòng', C.gold] : player.isBot ? [player.skill, C.pink] : ready ? ['Sẵn sàng', C.green] : ['Chưa', 'rgba(255,255,255,0.45)']
      ctx.font = `700 10px ${font}`
      ctx.textAlign = 'right'
      ctx.fillStyle = tag[1]
      const tagW = ctx.measureText(tag[0]).width
      ctx.fillText(tag[0], W - (player.isBot ? 26 : 8), H / 2 + 1)
      // tên
      ctx.font = `700 13px ${font}`
      ctx.textAlign = 'left'
      ctx.fillStyle = C.ink
      ctx.fillText(fitText(ctx, player.name, W - 44 - tagW - (player.isBot ? 22 : 0)), 33, H / 2 + 1)
    }}
  />
)
