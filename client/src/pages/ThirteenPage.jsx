import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, Modal, Radio, message } from 'antd'
import { Link, useSearchParams } from 'react-router-dom'
import UserMenu from '../components/Auth/UserMenu'
import { useAuth } from '../contexts/AuthContext'
import { ThirteenProvider, useThirteen } from '../contexts/ThirteenContext'
import { clearTableAssets } from '../components/CardTable3D/assets'
import ThirteenOverlay from '../components/Thirteen/ThirteenOverlay'
import ThirteenRulesModal from '../components/Thirteen/ThirteenRulesModal'
import StakePicker from '../components/Thirteen/StakePicker'
import { canAffordStake, isRoomCode, roomStatus, stakeLabel, stakeOptionsOf } from '../utils/tableGame'
function ThirteenContent() {
  useEffect(() => clearTableAssets, [])
  const { user, requireAuth, balance } = useAuth()
  const state = useThirteen()
  const { tables, currentTable, config, action, busy } = state
  const [params, setParams] = useSearchParams()
  const room = params.get('room')?.toUpperCase()
  const [code, setCode] = useState(room || '')
  const [rulesOpen, setRulesOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [visibility, setVisibility] = useState('public')
  const [pickedStake, setPickedStake] = useState(null)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [dealOnMount, setDealOnMount] = useState(false)
  const [lastMatch, setLastMatch] = useState(null)
  const [now, setNow] = useState(Date.now())
  const seenMatch = useRef(null), previousTable = useRef(null), joinedLink = useRef(null)
  // Ván chỉ chia bài một lần: mọi đường đóng overlay đều xoá cờ, nên mở lại bằng thẻ bàn, link mời hay "Quay lại bàn" đều không chia lại.
  const closeOverlay = useCallback(() => { setOverlayOpen(false); setDealOnMount(false) }, [])
  const seated = Boolean(user?._id) && currentTable?.seats.some(s => s?.userId === user._id)
  const playing = seated && ['playing', 'settling'].includes(currentTable?.status)
  const userId = user?._id
  const clearResult = state.closeResult
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer) }, [])
  useEffect(() => {
    if (!seated) { previousTable.current = null; seenMatch.current = null; setLastMatch(null); closeOverlay(); return }
    if (previousTable.current?.tableId !== currentTable.tableId) setOverlayOpen(true)
    if (playing) {
      setLastMatch(currentTable)
      if (seenMatch.current !== currentTable.matchId) {
        setDealOnMount(['waiting', 'finished'].includes(previousTable.current?.status))
        seenMatch.current = currentTable.matchId
        setOverlayOpen(true)
        clearResult()
      }
    }
    previousTable.current = currentTable
  }, [currentTable, seated, playing, clearResult, closeOverlay])
  useEffect(() => {
    if (room === undefined) { joinedLink.current = null; return }
    if (joinedLink.current === `${room}:${userId || 'guest'}`) return
    joinedLink.current = `${room}:${userId || 'guest'}`
    const clearRoom = () => setParams(current => {
      if (current.get('room')?.toUpperCase() !== room) return current
      const next = new URLSearchParams(current)
      next.delete('room')
      return next
    }, { replace: true })
    if (!isRoomCode(room)) {
      message.open({ key: 'table-game', type: 'error', content: 'Mã bàn không tồn tại' })
      clearRoom()
    } else if (!userId) requireAuth('Đăng nhập để vào bàn được mời.')
    else action('sit', room, { retryTransient: true }).then(ok => { if (ok) setOverlayOpen(true) }).finally(clearRoom)
  }, [room, userId, action, requireAuth, setParams])
  const join = async (name, value) => { if (await action(name, value)) { setOverlayOpen(true); setCreateOpen(false) } }
  // Mức mặc định của server; nếu số dư không đủ thì mở sẵn "Chơi vui" thay vì một lựa chọn bị khoá.
  const wantedStake = pickedStake ?? config.stake
  const createStake = canAffordStake(wantedStake, balance) ? wantedStake : 0
  const create = async () => { if (await action('create', visibility, { stake: createStake })) { setOverlayOpen(true); setCreateOpen(false) } }
  const finalTable = useMemo(() => state.result && lastMatch?.matchId === state.result.matchId && currentTable?.status === 'finished' ? {
    ...currentTable, ...state.result.publicView, matchId: lastMatch.matchId, pot: lastMatch.pot, seats: currentTable.seats.map((seat, i) => seat ? { ...state.result.publicView?.seats?.[i], ...seat } : null), status: 'finished', currentSeat: null,
  } : currentTable, [state.result, lastMatch, currentTable])
  const joinable = table => ['waiting', 'finished'].includes(table.status) && table.seats.some(seat => !seat)
  const publicTables = tables.filter(table => table.visibility !== 'private').sort((a, b) => Number(joinable(b)) - Number(joinable(a)) || b.seats.filter(Boolean).length - a.seats.filter(Boolean).length)
  return <div className='thirteen-page'>
    <header className='thirteen-header'><Link to='/games' className='sp-btn sp-btn--ghost'>← Chọn game</Link><div><h1>Tiến Lên Miền Nam</h1><p>13 lá bài. Bốn ghế. Ai hết bài trước?</p></div><Button className='sp-btn' onClick={() => setRulesOpen(true)}>Luật chơi</Button><UserMenu /></header>
    <main>
      {seated && <div className='sp-panel thirteen-resume'>Bạn đang ở bàn {currentTable.code || currentTable.tableId} · {roomStatus(currentTable, now)}<Button className='sp-btn sp-btn--primary' onClick={() => setOverlayOpen(true)}>Quay lại bàn</Button></div>}
      <div className='thirteen-hero'>
        <Button className='sp-btn sp-btn--primary' disabled={busy || seated} onClick={() => join('quickJoin')}>Chơi nhanh</Button>
        <Button className='sp-btn' disabled={busy || seated} onClick={() => setCreateOpen(true)}>Tạo bàn</Button>
        <form onSubmit={event => { event.preventDefault(); if (isRoomCode(code)) join('sit', code) }}><Input aria-label='Nhập mã bàn' placeholder='Nhập mã bàn' maxLength={4} value={code} onChange={event => setCode(event.target.value.toUpperCase())} /><Button htmlType='submit' className='sp-btn' disabled={busy || seated || !isRoomCode(code)}>Vào</Button></form>
      </div>
      <p className='thirteen-stake'>Mỗi bàn có mức cược riêng do chủ bàn chọn, tính cho mỗi người khi có từ 2 người thật · Chơi nhanh vào bàn mức {stakeLabel(config.stake)} · Chơi một mình là ván tập (miễn phí)</p>
      <div className='thirteen-lobby'>{publicTables.map(table => <section className='sp-panel' key={table.tableId}>
        <div className='thirteen-status'><h2>Bàn {table.code || table.tableId}</h2>{typeof table.stake === 'number' && <span className='thirteen-chip thirteen-chip--stake'>{stakeLabel(table.stake)}</span>}<span className='thirteen-chip'>{table.startsAt ? `Sắp bắt đầu ${roomStatus(table, now).split(' ').at(-1)}s` : roomStatus(table, now)}</span></div>
        <ul className='thirteen-seats'>{table.seats.map((seat, i) => <li key={i}><span className='thirteen-avatar'>{seat?.username?.slice(0, 2).toUpperCase() || '—'}</span><span>{seat?.username || 'Trống'}{seat?.userId && seat.userId === table.hostId && <> <span role='img' aria-label='Chủ bàn'>👑</span></>}{seat?.ready && ' ✓'}</span></li>)}</ul>
        <Button className='sp-btn' disabled={busy || (seated && currentTable.tableId !== table.tableId) || (!['waiting', 'finished'].includes(table.status) && currentTable?.tableId !== table.tableId) || (table.seats.every(Boolean) && currentTable?.tableId !== table.tableId)} onClick={() => currentTable?.tableId === table.tableId ? setOverlayOpen(true) : join('sit', table.tableId)}>{['playing', 'settling'].includes(table.status) && currentTable?.tableId !== table.tableId ? 'Đang chơi' : 'Vào bàn'}</Button>
      </section>)}</div>
      {!publicTables.length && <p role='status'>Chưa có bàn nào — Chơi nhanh để tạo bàn mới</p>}
    </main>
    <Modal title='Tạo bàn' open={createOpen} onCancel={() => setCreateOpen(false)} footer={<Button className='sp-btn sp-btn--primary' disabled={busy} onClick={create}>Tạo bàn</Button>}><Radio.Group value={visibility} onChange={event => setVisibility(event.target.value)}><Radio value='public'>Công khai</Radio><Radio value='private'>Riêng tư (chỉ vào bằng mã)</Radio></Radio.Group><div className='thirteen-stake-row'><span>Mức cược mỗi người</span><StakePicker options={stakeOptionsOf(config)} value={createStake} balance={balance} onChange={setPickedStake} /></div></Modal>
    {seated && <ThirteenOverlay key={userId} {...state} balance={balance} table={finalTable} userId={userId} open={overlayOpen} onClose={closeOverlay} dealOnMount={dealOnMount} turnMs={config.turnMs} />}
    <ThirteenRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
  </div>
}
export default function ThirteenPage() { return <ThirteenProvider><ThirteenContent /></ThirteenProvider> }
