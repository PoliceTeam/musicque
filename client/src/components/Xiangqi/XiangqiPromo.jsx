import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import XiangqiRulesModal from './XiangqiRulesModal'
import { restoreStickyPosition, snapStickyPosition } from '../../utils/xiangqiSticky'

const POSITION_STORAGE_KEY = 'musicque_xiangqi_sticky_position'

const XiangqiPromo = ({ onDismiss, bottomInset = 12 }) => {
  const navigate = useNavigate()
  const [rulesOpen, setRulesOpen] = useState(false)
  const [position, setPosition] = useState(null)
  const [dragging, setDragging] = useState(false)
  const cardRef = useRef(null)
  const dragRef = useRef(null)

  const getDimensions = useCallback(() => ({
    width: cardRef.current?.offsetWidth || 238,
    height: cardRef.current?.offsetHeight || 92,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    bottomInset,
  }), [bottomInset])

  useEffect(() => {
    let saved
    try { saved = JSON.parse(localStorage.getItem(POSITION_STORAGE_KEY)) } catch { saved = null }
    setPosition(restoreStickyPosition(saved, getDimensions()))

    const onResize = () => setPosition((current) => restoreStickyPosition(current, getDimensions()))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [getDimensions])

  const play = () => {
    setRulesOpen(false)
    navigate('/xiangqi')
  }

  const startDrag = (event) => {
    if (event.button !== 0 || event.target.closest('button')) return
    const rect = cardRef.current.getBoundingClientRect()
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      x: rect.left,
      y: rect.top,
    }
    cardRef.current.setPointerCapture(event.pointerId)
    setDragging(true)
    event.preventDefault()
  }

  const moveDrag = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return
    const { width, height, viewportWidth, viewportHeight } = getDimensions()
    const x = Math.min(viewportWidth - width, Math.max(0, event.clientX - dragRef.current.offsetX))
    const y = Math.min(viewportHeight - height, Math.max(0, event.clientY - dragRef.current.offsetY))
    dragRef.current.x = x
    dragRef.current.y = y
    setPosition({ edge: null, x, y })
  }

  const endDrag = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return
    const drag = dragRef.current
    const { width, height, viewportWidth, viewportHeight } = getDimensions()
    drag.x = Math.min(viewportWidth - width, Math.max(0, event.clientX - drag.offsetX))
    drag.y = Math.min(viewportHeight - height, Math.max(0, event.clientY - drag.offsetY))
    dragRef.current = null
    setDragging(false)
    const snapped = snapStickyPosition({ x: drag.x, y: drag.y, ...getDimensions() })
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(snapped))
    setPosition(snapped)
  }

  return (
    <section
      ref={cardRef}
      className={`xiangqi-promo xiangqi-promo--sticky${dragging ? ' is-dragging' : ''}`}
      aria-label='Chiến cờ chiếm PCs'
      style={position ? { left: position.x, top: position.y } : undefined}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <span className='xiangqi-promo__drag' aria-hidden='true'>⠿</span>
      <button type='button' className='xiangqi-promo__close' onClick={onDismiss} aria-label='Ẩn quảng bá cờ tướng'>✕</button>
      <div className='xiangqi-promo__glow' aria-hidden='true' />
      <div className='xiangqi-promo__piece' aria-hidden='true'>將</div>
      <div className='xiangqi-promo__copy'>
        <h2>Chiến cờ chiếm PCs</h2>
        <p>Cược 10 PC · Thắng tới 66 PC</p>
        <div className='xiangqi-promo__actions'>
          <button type='button' className='xiangqi-promo__primary' onClick={play}>Chơi ngay</button>
          <button type='button' className='xiangqi-promo__secondary' onClick={() => setRulesOpen(true)}>Luật</button>
        </div>
      </div>
      <XiangqiRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} onPlay={play} />
    </section>
  )
}

export default XiangqiPromo
