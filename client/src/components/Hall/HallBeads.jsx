import React, { useEffect, useRef, useState } from 'react'
import { BEADS_PER_LAP, beadProgress } from '../../three/hall/layout'

const STEP_PX = 30
const MIN_GAP_MS = 110 // server nhận tối đa 10 hạt/giây
const VISIBLE = 11 // số hạt vẽ trong khung (thừa hai đầu để hạt trôi vào/ra không bị hụt)
const SNAP_MS = 170

// Tràng hạt: kéo lên/xuống (hoặc lăn chuột, phím mũi tên) để lăn. Chuỗi hạt trôi liên tục theo tay;
// mỗi hạt đi qua vạch giữa là một hạt. Hạt đi qua nhanh hơn server nhận thì xếp hàng gửi dần.
const HallBeads = ({ initial, onBead, onLap, onClose }) => {
  const [total, setTotal] = useState(initial)
  const [scroll, setScroll] = useState(0)
  const [celebrate, setCelebrate] = useState(false)
  const totalRef = useRef(initial)
  const scrollRef = useRef(0)
  const stepRef = useRef(0)
  const pending = useRef(0)
  const lastSent = useRef(-Infinity)
  const flushTimer = useRef(null)
  const lapTimer = useRef(null)
  const anim = useRef(0)
  const drag = useRef(null)
  const { count, lap } = beadProgress(total)

  useEffect(() => () => {
    clearTimeout(flushTimer.current)
    clearTimeout(lapTimer.current)
    cancelAnimationFrame(anim.current)
  }, [])

  const flush = () => {
    flushTimer.current = null
    if (!pending.current) return
    const wait = MIN_GAP_MS - (performance.now() - lastSent.current)
    if (wait > 0) {
      flushTimer.current = setTimeout(flush, wait)
      return
    }
    pending.current--
    lastSent.current = performance.now()
    onBead()
    const next = totalRef.current + 1
    totalRef.current = next
    setTotal(next)
    if (next % BEADS_PER_LAP === 0) {
      onLap()
      setCelebrate(true)
      clearTimeout(lapTimer.current)
      lapTimer.current = setTimeout(() => setCelebrate(false), 4200)
    }
    if (pending.current) flushTimer.current = setTimeout(flush, MIN_GAP_MS)
  }

  const moveTo = (px) => {
    scrollRef.current = px
    setScroll(px)
    const step = Math.trunc(px / STEP_PX)
    const crossed = Math.abs(step - stepRef.current)
    if (!crossed) return
    stepRef.current = step
    pending.current += crossed
    if (!flushTimer.current) flush()
  }

  // Trượt êm tới một vị trí (thả tay, lăn chuột, phím); vẫn đếm hạt đi qua trên đường trượt.
  const glideTo = (target) => {
    cancelAnimationFrame(anim.current)
    const from = scrollRef.current
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / SNAP_MS)
      moveTo(from + (target - from) * (1 - (1 - t) ** 3))
      if (t < 1) anim.current = requestAnimationFrame(tick)
    }
    anim.current = requestAnimationFrame(tick)
  }
  const nudge = (dir) => glideTo((Math.round(scrollRef.current / STEP_PX) + dir) * STEP_PX)

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    cancelAnimationFrame(anim.current)
    drag.current = { y: e.clientY }
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    const dy = e.clientY - drag.current.y
    drag.current.y = e.clientY
    moveTo(scrollRef.current + dy)
  }
  const onPointerUp = () => {
    if (!drag.current) return
    drag.current = null
    glideTo(Math.round(scrollRef.current / STEP_PX) * STEP_PX)
  }

  const base = Math.floor(scroll / STEP_PX)
  const shift = scroll - base * STEP_PX
  const half = Math.floor(VISIBLE / 2)

  return (
    <aside className={`hall-panel hall-beads${celebrate ? ' is-lap' : ''}`} aria-label='Tràng hạt'>
      <header className='hall-panel__head'>
        <strong>Tràng hạt</strong>
        <button type='button' className='hall-panel__close' onClick={onClose} aria-label='Đóng tràng hạt'>Đóng</button>
      </header>
      <div
        className='hall-beads__strand'
        role='slider'
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={BEADS_PER_LAP}
        aria-valuenow={count}
        aria-label='Kéo lên xuống để lăn hạt'
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(e) => { if (Math.abs(e.deltaY) > 4) nudge(Math.sign(e.deltaY)) }}
        onKeyDown={(e) => {
          if (!['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) return
          e.preventDefault()
          e.stopPropagation()
          nudge(e.key === 'ArrowUp' ? -1 : 1)
        }}
      >
        <div className='hall-beads__cord' />
        <div className='hall-beads__mark' aria-hidden='true' />
        {Array.from({ length: VISIBLE }, (_, i) => {
          const y = (i - half) * STEP_PX + shift
          return (
            <span
              key={i - base}
              className={`hall-bead${Math.abs(y) < STEP_PX / 2 ? ' is-current' : ''}`}
              style={{ transform: `translateY(${y.toFixed(1)}px)${Math.abs(y) < STEP_PX / 2 ? ' scale(1.18)' : ''}` }}
            />
          )
        })}
      </div>
      <div className='hall-beads__count'>
        <span className='hall-beads__n'>{count} / {BEADS_PER_LAP}</span>
        {lap > 1 && <span className='hall-beads__lap'>vòng {lap}</span>}
      </div>
      <p className='hall-beads__note' aria-live='polite'>
        {celebrate ? 'Tròn một vòng 108 hạt. Thở chậm một hơi rồi đi tiếp.' : 'Kéo lên hoặc xuống để lăn hạt.'}
      </p>
    </aside>
  )
}

export default HallBeads
