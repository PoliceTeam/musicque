import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useWordChain } from '../../contexts/WordChainContext'
import { getWordChainRemaining } from '../../utils/wordChain'
import { restoreStickyPosition, snapStickyPosition } from '../../utils/xiangqiSticky'
import WordChainOverlay from './WordChainOverlay'
import WordChainRulesModal from './WordChainRulesModal'

const POSITION_STORAGE_KEY = 'musicque_wordchain_sticky_position'

const WordChainPromo = ({ onDismiss, bottomInset = 12 }) => {
  const { active, round, config } = useWordChain()
  const [gameOpen, setGameOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [position, setPosition] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [now, setNow] = useState(Date.now())
  const cardRef = useRef(null)
  const dragRef = useRef(null)

  const getDimensions = useCallback(() => ({
    width: cardRef.current?.offsetWidth || 250,
    height: cardRef.current?.offsetHeight || 102,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    bottomInset,
  }), [bottomInset])

  useEffect(() => {
    let saved
    try { saved = JSON.parse(localStorage.getItem(POSITION_STORAGE_KEY)) } catch { saved = null }
    const dimensions = getDimensions()
    if (saved) setPosition(restoreStickyPosition(saved, dimensions))
    else setPosition(snapStickyPosition({ x: 12, y: dimensions.viewportHeight, ...dimensions }))
    const onResize = () => setPosition((current) => restoreStickyPosition(current, getDimensions()))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [getDimensions])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(interval)
  }, [])

  const startDrag = (event) => {
    if (event.button !== 0 || event.target.closest('button')) return
    const rect = cardRef.current.getBoundingClientRect()
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, x: rect.left, y: rect.top }
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
    dragRef.current = null
    setDragging(false)
    const snapped = snapStickyPosition({ x: drag.x, y: drag.y, ...getDimensions() })
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(snapped))
    setPosition(snapped)
  }

  const remaining = getWordChainRemaining(round, now)
  return (
    <>
      <section
        ref={cardRef}
        className={`wordchain-promo${dragging ? ' is-dragging' : ''}`}
        style={position ? { left: position.x, top: position.y } : undefined}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-label='Game nối từ giành PCs'
      >
        <span className='wordchain-promo__drag' aria-hidden='true'>⠿</span>
        <button type='button' className='wordchain-promo__close' onClick={onDismiss} aria-label='Ẩn game nối từ'>✕</button>
        <div className='wordchain-promo__icon' aria-hidden='true'>🔗</div>
        <div className='wordchain-promo__copy'>
          <h2>Nối từ giành PCs</h2>
          <p>{active && round ? <><strong>{round.currentPhrase}</strong> · {remaining}s</> : 'Đang chuẩn bị ván...'}</p>
          <div><button type='button' onClick={() => setGameOpen(true)}>Nối ngay</button><button type='button' onClick={() => setRulesOpen(true)}>Luật</button></div>
        </div>
        <span className='wordchain-promo__badge'>Tối đa {config.roundPayoutCap} PC</span>
      </section>
      <WordChainOverlay open={gameOpen} onClose={() => setGameOpen(false)} />
      <WordChainRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} onPlay={() => { setRulesOpen(false); setGameOpen(true) }} />
    </>
  )
}

export default WordChainPromo
