import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ThirteenTable3D from './ThirteenTable3D'
import ThirteenHud from './ThirteenHud'
import ThirteenRulesModal from './ThirteenRulesModal'
export default function ThirteenOverlay({ open, onClose, table, userId, result, dealOnMount = false, ...state }) {
  const [rulesOpen, setRulesOpen] = useState(false)
  const [handLowered, setHandLowered] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const dialog = useRef()
  useEffect(() => { setHandLowered(false) }, [table?.matchId])
  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement
    document.body.style.overflow = 'hidden'
    dialog.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (rulesOpen) setRulesOpen(false)
        else onClose()
      }
      if (event.key === 'Tab' && !rulesOpen) {
        const buttons = dialog.current?.querySelectorAll('button:not(:disabled), input:not(:disabled)')
        const first = buttons?.[0], last = buttons?.[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKey); previousFocus?.focus() }
  }, [open, onClose, rulesOpen])
  useEffect(() => {
    setShowResult(false)
    if (!result) return undefined
    const timer = window.setTimeout(() => setShowResult(true), window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 1800)
    return () => window.clearTimeout(timer)
  }, [result])
  if (!open || !table) return null
  const finished = table.status === 'settled'
  return createPortal(<div className='th-overlay'>
    <section className='th-game' role='dialog' aria-modal='true' aria-labelledby='th-game-title' tabIndex={-1} ref={dialog}>
      <ThirteenTable3D {...state} table={table} userId={userId} dealOnMount={dealOnMount} firstPerson handLowered={handLowered} />
      <header className='th-game-header'>
        <div><span className='sp-eyebrow'>BÀN {table.tableId} · {finished ? 'KẾT THÚC' : 'ĐANG CHƠI'}</span><h2 id='th-game-title'>Tiến Lên Miền Nam</h2><small>Bạn vẫn ngồi bàn; hết giờ sẽ tự đánh</small></div>
        <strong>Quỹ thưởng: {table.pot} PC</strong>
        <div className='thirteen-actions'><button type='button' className='sp-btn' onClick={() => setRulesOpen(true)} aria-label='Xem luật'>?</button><button type='button' className='sp-btn' onClick={onClose} aria-label='Đóng'>✕</button></div>
      </header>
      {!finished && <ThirteenHud {...state} table={table} userId={userId} handLowered={handLowered} toggleHand={() => setHandLowered(value => !value)} />}
      {finished && <div className='th-game-end'>
        {showResult && <div role='status'>{result?.ranking.map((seat, i) => <p key={seat.seat}>{['Nhất', 'Nhì', 'Ba', 'Bét'][i]} · {seat.username} · +{result.payouts.find(p => p.userId === seat.userId)?.amount || 0} PC</p>)}</div>}
        <div className='thirteen-actions'>{table.hostId === userId && <button type='button' className='sp-btn sp-btn--primary' disabled={state.busy} onClick={() => state.action('start', table.tableId)}>Ván mới</button>}<button type='button' className='sp-btn' onClick={onClose}>Về sảnh</button></div>
      </div>}
      <ThirteenRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </section>
  </div>, document.body)
}
