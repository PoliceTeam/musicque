import React, { useEffect, useRef, useState } from 'react'
import { BEADS_PER_LAP, beadProgress } from '../../three/hall/layout'

const STEP_PX = 30
const VISIBLE = 11 // số hạt vẽ trong khung (thừa hai đầu để hạt trôi vào/ra không bị hụt)
const SNAP_MS = 170

// Mỗi bước một hạt, giữ nhịp cố định khi cuộn liên tục; không xếp hàng sau khi dừng.
const HallBeads = ({ initial, onBead, onLap, onClose }) => {
  const [total, setTotal] = useState(initial)
  const [scroll, setScroll] = useState(0)
  const [celebrate, setCelebrate] = useState(false)
  const totalRef = useRef(initial)
  const offsetRef = useRef(0)
  const lastStep = useRef(-Infinity)
  const panelRef = useRef(null)
  const nudgeRef = useRef(null)
  const lapTimer = useRef(null)
  const anim = useRef(0)
  const { count, lap } = beadProgress(total)

  useEffect(() => () => {
    clearTimeout(lapTimer.current)
    cancelAnimationFrame(anim.current)
  }, [])

  const nudge = (dir) => {
    const start = performance.now()
    if (start - lastStep.current < SNAP_MS) return
    lastStep.current = start
    cancelAnimationFrame(anim.current)
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
    const from = offsetRef.current
    const target = from + dir * STEP_PX
    offsetRef.current = target
    const tick = (now) => {
      const t = Math.min(1, (now - start) / SNAP_MS)
      const px = from + (target - from) * (1 - (1 - t) ** 3)
      setScroll(px)
      anim.current = t < 1 ? requestAnimationFrame(tick) : 0
    }
    anim.current = requestAnimationFrame(tick)
  }
  nudgeRef.current = nudge

  useEffect(() => {
    const panel = panelRef.current
    const wheel = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!e.deltaY) return
      nudgeRef.current(Math.sign(e.deltaY))
    }
    panel.addEventListener('wheel', wheel, { passive: false })
    return () => {
      panel.removeEventListener('wheel', wheel)
    }
  }, [])

  const base = Math.floor(scroll / STEP_PX)
  const shift = scroll - base * STEP_PX
  const half = Math.floor(VISIBLE / 2)

  return (
    <aside ref={panelRef} className={`hall-panel hall-beads${celebrate ? ' is-lap' : ''}`} aria-label='Tràng hạt'>
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
        aria-label='Lần hạt bằng con lăn chuột'
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
        {celebrate ? 'Tròn một vòng 108 hạt. Thở chậm một hơi rồi đi tiếp.' : 'Lăn con lăn chuột lên hoặc xuống để lần hạt.'}
      </p>
    </aside>
  )
}

export default HallBeads
