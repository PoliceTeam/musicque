import React, { useEffect, useRef } from 'react'
import {
  BALL_STYLES,
  DIFFICULTY_COLOR,
  getPlaybackState,
  interpolateFrame,
  getCueOffset,
} from '../../utils/billiards'

const RAIL = 15 // bề rộng khung gỗ quanh mặt vải (cm)
const CUE_LENGTH = 145 // chiều dài cây cơ vẽ ra (cm)

const roundRect = (ctx, x, y, w, h, r) => {
  if (ctx.roundRect) {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
    return
  }
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const drawTable = (ctx, table, worldW, worldH) => {
  const { width: W, height: H } = table

  // Khung gỗ
  const wood = ctx.createLinearGradient(0, 0, 0, worldH)
  wood.addColorStop(0, '#6d4526')
  wood.addColorStop(0.5, '#4e2f18')
  wood.addColorStop(1, '#37200f')
  ctx.fillStyle = wood
  roundRect(ctx, 0, 0, worldW, worldH, 7)
  ctx.fill()

  // Băng (cushion) — viền xanh đậm ôm mặt vải
  ctx.fillStyle = '#0d5433'
  roundRect(ctx, RAIL - 3.5, RAIL - 3.5, W + 7, H + 7, 2)
  ctx.fill()

  // Mặt vải
  const cloth = ctx.createLinearGradient(RAIL, RAIL, RAIL + W * 0.4, RAIL + H)
  cloth.addColorStop(0, '#1a7a4d')
  cloth.addColorStop(0.55, '#146b43')
  cloth.addColorStop(1, '#0f5a38')
  ctx.fillStyle = cloth
  ctx.fillRect(RAIL, RAIL, W, H)

  // Tối bốn góc cho có chiều sâu
  const vignette = ctx.createRadialGradient(
    RAIL + W / 2,
    RAIL + H / 2,
    H * 0.25,
    RAIL + W / 2,
    RAIL + H / 2,
    W * 0.62,
  )
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.32)')
  ctx.fillStyle = vignette
  ctx.fillRect(RAIL, RAIL, W, H)

  // Chấm định vị trên khung gỗ
  ctx.fillStyle = 'rgba(240, 226, 200, 0.55)'
  for (let i = 1; i < 8; i += 1) {
    if (i === 4) continue // chỗ lỗ giữa
    const x = RAIL + (W * i) / 8
    ctx.beginPath()
    ctx.arc(x, RAIL / 2, 1.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, worldH - RAIL / 2, 1.1, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 1; i < 4; i += 1) {
    const y = RAIL + (H * i) / 4
    ctx.beginPath()
    ctx.arc(RAIL / 2, y, 1.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(worldW - RAIL / 2, y, 1.1, 0, Math.PI * 2)
    ctx.fill()
  }

  // Điểm đặt bi (foot spot)
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.beginPath()
  ctx.arc(RAIL + W * 0.75, RAIL + H / 2, 0.9, 0, Math.PI * 2)
  ctx.fill()

  // Lỗ
  table.pockets.forEach((pocket) => {
    const cx = RAIL + pocket.x
    const cy = RAIL + pocket.y
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath()
    ctx.arc(cx, cy, pocket.r * 1.45, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#0a0a0c'
    ctx.beginPath()
    ctx.arc(cx, cy, pocket.r * 1.15, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,235,190,0.25)'
    ctx.lineWidth = 0.7
    ctx.stroke()
  })
}

// `appear` 0→1 dùng cho lúc NPC đặt lại bi cái xuống bàn
const drawBall = (ctx, ball, radius, scale, appear = 1) => {
  const style = BALL_STYLES[ball.id] || BALL_STYLES[0]
  const sink = ball.sink || 0
  if (sink >= 1 || appear <= 0) return

  const r = radius * (1 - sink * 0.9) * (0.7 + 0.3 * appear)
  ctx.save()
  ctx.globalAlpha = (1 - sink) * appear

  // Bóng đổ
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.beginPath()
  ctx.ellipse(ball.x + r * 0.22, ball.y + r * 0.3, r * 0.98, r * 0.85, 0, 0, Math.PI * 2)
  ctx.fill()

  // Thân bi
  const base = ctx.createRadialGradient(
    ball.x - r * 0.36,
    ball.y - r * 0.4,
    r * 0.06,
    ball.x,
    ball.y,
    r,
  )
  base.addColorStop(0, '#ffffff')
  base.addColorStop(0.16, style.striped ? '#fdfdfd' : style.color)
  base.addColorStop(1, style.striped ? '#b9b5ac' : '#000000')
  ctx.fillStyle = base
  ctx.beginPath()
  ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2)
  ctx.fill()

  // Bi 9 là bi sọc: kẻ dải màu ngang giữa
  if (style.striped) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2)
    ctx.clip()
    const stripe = ctx.createLinearGradient(0, ball.y - r * 0.5, 0, ball.y + r * 0.5)
    stripe.addColorStop(0, style.color)
    stripe.addColorStop(1, '#b98d00')
    ctx.fillStyle = stripe
    ctx.fillRect(ball.x - r, ball.y - r * 0.52, r * 2, r * 1.04)
    ctx.restore()
  }

  // Vòng số + số bi (chỉ vẽ khi đủ to để đọc)
  if (ball.id > 0) {
    const px = r * scale
    ctx.fillStyle = '#fdfdfb'
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, r * 0.47, 0, Math.PI * 2)
    ctx.fill()
    if (px >= 7) {
      ctx.fillStyle = '#1b1b1b'
      ctx.font = `700 ${r * 0.62}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(ball.id), ball.x, ball.y + r * 0.03)
    }
  }

  // Điểm cao sáng
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.ellipse(
    ball.x - r * 0.34,
    ball.y - r * 0.38,
    r * 0.26,
    r * 0.18,
    -Math.PI / 4,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  ctx.restore()
}

// Cây cơ của NPC: đây là "nhân vật" duy nhất trong ván
const drawCue = (ctx, cueBall, angle, offset, ballRadius) => {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const tipX = cueBall.x - cos * (ballRadius + offset)
  const tipY = cueBall.y - sin * (ballRadius + offset)
  const buttX = tipX - cos * CUE_LENGTH
  const buttY = tipY - sin * CUE_LENGTH
  const px = -sin
  const py = cos
  const tipHalf = 0.55
  const buttHalf = 1.5

  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.beginPath()
  ctx.moveTo(tipX + px * tipHalf + 1.2, tipY + py * tipHalf + 1.6)
  ctx.lineTo(buttX + px * buttHalf + 1.2, buttY + py * buttHalf + 1.6)
  ctx.lineTo(buttX - px * buttHalf + 1.2, buttY - py * buttHalf + 1.6)
  ctx.lineTo(tipX - px * tipHalf + 1.2, tipY - py * tipHalf + 1.6)
  ctx.closePath()
  ctx.fill()

  const shaft = ctx.createLinearGradient(tipX, tipY, buttX, buttY)
  shaft.addColorStop(0, '#f0d9a8')
  shaft.addColorStop(0.42, '#d9a441')
  shaft.addColorStop(0.62, '#7a4a1d')
  shaft.addColorStop(1, '#2f1c0d')
  ctx.fillStyle = shaft
  ctx.beginPath()
  ctx.moveTo(tipX + px * tipHalf, tipY + py * tipHalf)
  ctx.lineTo(buttX + px * buttHalf, buttY + py * buttHalf)
  ctx.lineTo(buttX - px * buttHalf, buttY - py * buttHalf)
  ctx.lineTo(tipX - px * tipHalf, tipY - py * tipHalf)
  ctx.closePath()
  ctx.fill()

  // Đầu cơ (lơ xanh)
  ctx.fillStyle = '#3f7ec9'
  ctx.beginPath()
  ctx.arc(tipX, tipY, tipHalf * 1.05, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// Đường bi mục tiêu → lỗ, tô theo độ khó. Chỉ hiện trong pha chờ, để người
// xem thấy NPC đang có mấy lựa chọn trước khi nó vào cơ.
const drawOptionLine = (ctx, target, pocket, difficulty) => {
  if (!pocket) return
  ctx.save()
  ctx.globalAlpha = difficulty === 'easy' ? 0.85 : difficulty === 'medium' ? 0.65 : 0.5
  ctx.strokeStyle = DIFFICULTY_COLOR[difficulty] || DIFFICULTY_COLOR.medium
  ctx.lineWidth = difficulty === 'easy' ? 0.9 : 0.6
  ctx.setLineDash(difficulty === 'hard' ? [1.6, 2.6] : [3.4, 2.4])
  ctx.beginPath()
  ctx.moveTo(target.x, target.y)
  ctx.lineTo(pocket.x, pocket.y)
  ctx.stroke()
  ctx.restore()
}

// Vòng tròn nét đứt co lại — dấu hiệu NPC đang đặt bi cái xuống chỗ mới
const drawPlacementRing = (ctx, cueBall, ballRadius, appear) => {
  ctx.save()
  ctx.globalAlpha = 0.75 * (1 - appear)
  ctx.strokeStyle = '#ffe9a0'
  ctx.lineWidth = 0.5
  ctx.setLineDash([2, 2.4])
  ctx.beginPath()
  ctx.arc(cueBall.x, cueBall.y, ballRadius * (1 + 2.6 * (1 - appear)), 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

const drawAimLine = (ctx, cueBall, angle, alpha) => {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'
  ctx.lineWidth = 0.45
  ctx.setLineDash([2.6, 3.2])
  ctx.beginPath()
  ctx.moveTo(cueBall.x, cueBall.y)
  ctx.lineTo(cueBall.x + Math.cos(angle) * 70, cueBall.y + Math.sin(angle) * 70)
  ctx.stroke()
  ctx.restore()
}

const BilliardsTable = ({ game }) => {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const gameRef = useRef(game)

  useEffect(() => {
    gameRef.current = game
  }, [game])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return undefined

    const ctx = canvas.getContext('2d')
    let raf = null
    let scale = 1

    const fallbackTable = { width: 254, height: 127, ballRadius: 2.85, pockets: [] }

    const layout = () => {
      const table = gameRef.current?.table || fallbackTable
      const worldW = table.width + RAIL * 2
      const worldH = table.height + RAIL * 2
      const dpr = window.devicePixelRatio || 1
      const cssW = Math.max(240, wrap.clientWidth)
      const cssH = (cssW * worldH) / worldW

      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      scale = cssW / worldW
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0)
    }

    const draw = () => {
      const current = gameRef.current
      const table = current?.table || fallbackTable
      const worldW = table.width + RAIL * 2
      const worldH = table.height + RAIL * 2

      ctx.clearRect(0, 0, worldW, worldH)
      drawTable(ctx, table, worldW, worldH)

      ctx.save()
      ctx.translate(RAIL, RAIL)

      if (!current) {
        ctx.restore()
        return
      }

      const playback = getPlaybackState(current)
      const radius = table.ballRadius

      if (playback.phase === 'countdown' || playback.phase === 'idle') {
        // Chưa vào cơ phá: hiện bàn đã xếp bi
        const rack = current.rack || []
        rack.forEach((ball) => drawBall(ctx, ball, radius, scale))
        ctx.restore()
        return
      }

      const shot = playback.shot
      const balls = interpolateFrame(shot, playback.frame)

      if (playback.subPhase === 'wait') {
        // Bàn đứng yên chờ tới lượt — chưa dựng cây cơ. Vẽ sẵn các cửa ăn
        // được của bi mục tiêu để người xem cân nhắc (sau này là để cược).
        const target = balls.find((b) => b.id === shot.targetBall)
        const options = shot.options || []
        if (target) {
          options.forEach((option) => {
            drawOptionLine(ctx, target, table.pockets[option.pocket], option.difficulty)
          })
        }
        balls.forEach((ball) => drawBall(ctx, ball, radius, scale))
      } else if (playback.subPhase === 'aim') {
        const offset = getCueOffset(playback.aimProgress, shot.cue.power)
        const cueBall = balls.find((b) => b.id === 0) || shot.cue
        // Cơ được đặt lại bi cái: bi cái hiện dần ra thay vì nhảy cóc
        const appear = shot.ballInHand ? Math.min(1, playback.aimProgress / 0.4) : 1

        if (shot.ballInHand && appear < 1) drawPlacementRing(ctx, cueBall, radius, appear)
        drawAimLine(ctx, cueBall, shot.cue.angle, Math.min(1, playback.aimProgress * 2.2) * 0.8)
        balls.forEach((ball) =>
          drawBall(ctx, ball, radius, scale, ball.id === 0 ? appear : 1),
        )
        if (appear >= 1) drawCue(ctx, cueBall, shot.cue.angle, offset, radius)
      } else {
        balls.forEach((ball) => drawBall(ctx, ball, radius, scale))
      }

      ctx.restore()
    }

    const loop = () => {
      draw()
      raf = window.requestAnimationFrame(loop)
    }

    layout()
    loop()

    const observer = new ResizeObserver(() => layout())
    observer.observe(wrap)

    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [])

  return (
    <div className="bil-table" ref={wrapRef}>
      <canvas ref={canvasRef} className="bil-table__canvas" />
    </div>
  )
}

export default BilliardsTable
