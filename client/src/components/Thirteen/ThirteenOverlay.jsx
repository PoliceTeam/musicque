import React, { Profiler, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { message, Tooltip, ConfigProvider } from 'antd'
import ThirteenTable3D from './ThirteenTable3D'
import ThirteenHud, { TableCoins } from './ThirteenHud'
import ThirteenRulesModal from './ThirteenRulesModal'
import StakePicker from './StakePicker'
import { tableMoneyText } from '../CardTable3D/tableBoard'
import { resetCardTableView } from '../CardTable3D/dragLook'
import { inviteUrl, roomRemaining, roomStatus, stakeLabel, stakeOptionsOf } from '../../utils/tableGame'
export default function ThirteenOverlay({ open, onClose, table, userId, result, dealOnMount = false, ...state }) {
  const [rulesOpen, setRulesOpen] = useState(false)
  const [handLowered, setHandLowered] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [now, setNow] = useState(Date.now())
  const dialog = useRef()
  const scene = useMemo(() => <ThirteenTable3D table={table} userId={userId} myHand={state.myHand} selectedCards={state.selectedCards} toggleCard={state.toggleCard} turnMs={state.turnMs} dealOnMount={dealOnMount} firstPerson handLowered={handLowered} lastChatBySeat={state.lastChatBySeat} throws={state.throws} throwItem={state.throwItem} />, [table, userId, state.myHand, state.selectedCards, state.toggleCard, state.turnMs, dealOnMount, handLowered, state.lastChatBySeat, state.throws, state.throwItem])
  useEffect(() => { setHandLowered(false) }, [table?.matchId])
  useEffect(() => {
    if (!open) return undefined
    const interval = setInterval(() => setNow(Date.now()), 250)
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement
    document.body.style.overflow = 'hidden'
    dialog.current?.focus()
    const onKey = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (rulesOpen) setRulesOpen(false)
        else onClose()
      }
      if (event.key === 'Tab' && !rulesOpen) {
        const buttons = dialog.current?.querySelectorAll('button:not(:disabled):not([tabindex="-1"]), input:not(:disabled)')
        const first = buttons?.[0], last = buttons?.[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { clearInterval(interval); document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKey); previousFocus?.focus() }
  }, [open, onClose, rulesOpen])
  useEffect(() => {
    setShowResult(false)
    if (!result) return undefined
    const timer = window.setTimeout(() => setShowResult(true), window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 1800)
    return () => window.clearTimeout(timer)
  }, [result])
  if (!open || !table) return null
  const playing = ['playing', 'settling'].includes(table.status)
  const finished = table.status === 'finished'
  const me = table.seats.find(seat => seat?.userId === userId)
  const countdown = roomRemaining(table, table.startsAt, now)
  const hasStake = typeof table.stake === 'number'
  const isHost = Boolean(userId) && table.hostId === userId
  const host = table.seats.find(seat => seat?.userId && seat.userId === table.hostId)
  // Ván chỉ có người thật mới tính cược; một mình là ván tập nên không ghi số tiền lên nút.
  const readyAmount = table.stake > 0 && table.seats.filter(seat => seat?.userId).length >= 2 ? ` (cược ${table.stake} PC)` : ''
  const readyTime = roomRemaining(table, me?.readyDeadlineAt || table.readyDeadlineAt, now)
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(inviteUrl(table.code || table.tableId)); message.open({ key: 'table-game', type: 'success', content: 'Đã sao chép link mời' }) }
    catch { message.open({ key: 'table-game', type: 'error', content: 'Không sao chép được link mời. Hãy thử lại.' }) }
  }
  return createPortal(<ConfigProvider theme={{ components: { Tooltip: { zIndexPopup: 1301 } } }}><div className='th-overlay'>
    <section className='th-game' role='dialog' aria-modal='true' aria-labelledby='th-game-title' tabIndex={-1} ref={dialog}>
      <Profiler id='thirteen-table' onRender={(...sample) => { if (import.meta.env.DEV) window.__thirteenProfile?.(...sample) }}>
        {scene}
      </Profiler>
      <h2 id='th-game-title' className='thirteen-sr-only'>Tiến Lên Miền Nam</h2>
      <div className='thirteen-sr-only' aria-live='polite' aria-atomic='true'>Bàn {table.code || table.tableId}{table.visibility === 'private' ? ', riêng tư' : ''}, {finished && !table.startsAt ? 'kết thúc' : roomStatus(table, now).toLowerCase()}, {tableMoneyText(table).replace(/^./, letter => letter.toLowerCase())}{table.readyDeadlineAt ? `, ván mới sau ${readyTime}s` : ''}</div>
      <div className='th-game-corner-controls'>
        <TableCoins corner />
        <Tooltip trigger={['hover', 'focus']} title='Luật chơi'><button type='button' className='sp-btn th-icon' onClick={() => setRulesOpen(true)} aria-label='Luật chơi'>?</button></Tooltip>
        <Tooltip trigger={['hover', 'focus']} title='Về góc nhìn mặc định'><button type='button' className='sp-btn th-icon' onClick={resetCardTableView} aria-label='Về góc nhìn mặc định'>⌖</button></Tooltip>
        <Tooltip trigger={['hover', 'focus']} title={`Về sảnh — bạn vẫn giữ ghế${playing ? '; hết giờ sẽ tự đánh' : ''}`}><button type='button' className='sp-btn th-icon' onClick={onClose} aria-label='Thu nhỏ — về sảnh, vẫn giữ ghế'>−</button></Tooltip>
        <Tooltip trigger={['hover', 'focus']} title={playing ? 'Không thể rời khi đang chơi' : table.fundingPending ? 'Đang hoàn PC, vui lòng chờ' : 'Rời bàn'}><span tabIndex={playing || table.fundingPending || state.busy ? 0 : undefined}><button type='button' className='sp-btn th-icon' disabled={playing || table.fundingPending || state.busy} onClick={() => state.action('leave', table.tableId)} aria-label='Rời bàn'>⇥</button></span></Tooltip>
      </div>
      {playing && <ThirteenHud {...state} shortcutsEnabled={!rulesOpen} table={table} userId={userId} handLowered={handLowered} toggleHand={() => setHandLowered(value => !value)} />}
      {!playing && <div className='th-game-end'>
        {finished && showResult && result && <ol className='thirteen-results' aria-label='Kết quả ván'>{result.ranking.map((seat, i) => {
          const delta = (result.payouts.find(p => p.userId === seat.userId)?.amount || 0) - (result.stake || 0)
          return <li key={seat.seat}><span>{['🥇 Nhất', '🥈 Nhì', '🥉 Ba', 'Bét'][i]} · {seat.username}</span><strong>{seat.isBot ? 'Bot' : !result.stake ? 'Ván tập' : `${delta >= 0 ? '+' : '−'}${Math.abs(delta)} PC`}</strong></li>
        })}</ol>}
        {hasStake && <div className='thirteen-stake-row'>{isHost
          ? <StakePicker options={stakeOptionsOf(state.config)} value={table.stake} balance={state.balance} disabled={Boolean(table.startsAt) || table.fundingPending || state.busy} onChange={stake => state.action('setStake', table.tableId, stake)} />
          : <><span>Mức cược</span><strong>{stakeLabel(table.stake)}</strong></>}</div>}
        {hasStake && !isHost && host && <p>Chủ bàn: {host.username}</p>}
        <ul className='thirteen-ready-seats'>{table.seats.filter(seat => seat?.userId).map(seat => <li key={seat.userId}>{seat.username}<span>{seat.ready ? 'Sẵn sàng ✓' : 'Chưa sẵn sàng'}</span></li>)}</ul>
        {table.startsAt ? <p role='status'>Bắt đầu sau {countdown}…</p> : finished && table.readyDeadlineAt ? <p role='timer'>Tự rời bàn sau {readyTime}s nếu chưa sẵn sàng</p> : <p>Bot sẽ lấp các ghế trống khi bắt đầu.</p>}
        <div className='thirteen-actions'><button type='button' className='sp-btn sp-btn--primary' disabled={table.fundingPending || state.busy} onClick={() => state.action(me?.ready ? 'unready' : 'ready', table.tableId)}>{me?.ready ? table.startsAt ? 'Huỷ' : 'Huỷ sẵn sàng' : `${finished ? 'Sẵn sàng ván mới' : 'Sẵn sàng'}${readyAmount}`}</button><button type='button' className='sp-btn' onClick={copyInvite}>Sao chép link mời</button>{finished && <button type='button' className='sp-btn' disabled={table.fundingPending || state.busy} onClick={() => state.action('leave', table.tableId)}>Rời bàn</button>}</div>
      </div>}
      <ThirteenRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </section>
  </div></ConfigProvider>, document.body)
}
