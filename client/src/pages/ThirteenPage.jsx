import React, { useState } from 'react'
import { Button } from 'antd'
import { Link } from 'react-router-dom'
import UserMenu from '../components/Auth/UserMenu'
import { useAuth } from '../contexts/AuthContext'
import { ThirteenProvider, useThirteen } from '../contexts/ThirteenContext'
import ThirteenTable3D from '../components/Thirteen/ThirteenTable3D'
import ThirteenHud from '../components/Thirteen/ThirteenHud'
import ThirteenRulesModal from '../components/Thirteen/ThirteenRulesModal'
import '../components/Thirteen/thirteen.css'
function ThirteenContent() {
  const { user } = useAuth()
  const state = useThirteen()
  const { tables, currentTable, config, action, busy } = state
  const [rulesOpen, setRulesOpen] = useState(false)
  const seated = Boolean(user?._id) && currentTable?.seats.some((s) => s?.userId === user?._id)
  const playing = seated && ['playing', 'settling'].includes(currentTable?.status)
  const lobby = (<div className='thirteen-lobby'>
        {tables.map((table) => <section className='sp-panel' key={table.tableId}>
          <h2>Bàn {table.tableId}</h2>
          <p>{table.seats.filter(Boolean).length}/4 ghế · {table.status === 'waiting' ? 'Đang chờ' : 'Đang chơi'}</p>
          <ul>{table.seats.map((s, i) => <li key={i}>{s?.username || 'Ghế trống'}{s?.userId === table.hostId ? ' · Chủ bàn' : ''}</li>)}</ul>
          {user?._id && table.seats.some((s) => s?.userId === user._id) ? <div className='thirteen-actions'>
            <Button className='sp-btn' disabled={busy || table.status !== 'waiting'} onClick={() => action('leave', table.tableId)}>Rời bàn</Button>
            {table.hostId === user?._id && <Button className='sp-btn sp-btn--primary' disabled={busy || table.status !== 'waiting'} onClick={() => action('start', table.tableId)}>Bắt đầu</Button>}
          </div> : <Button className='sp-btn sp-btn--primary' disabled={busy || seated || table.status !== 'waiting' || table.seats.every(Boolean)} onClick={() => action('sit', table.tableId)}>Ngồi vào bàn</Button>}
        </section>)}
      </div>)
  return <div className={`thirteen-page ${playing ? 'thirteen-page--playing' : ''}`}>
    <header className='thirteen-header'><Link to='/' className='sp-btn sp-btn--ghost'>← Về trang chủ</Link><UserMenu /></header>
    <main>
      <div className='thirteen-heading'><div><span className='sp-eyebrow'>BÀN BÀI MUSICQUE</span><h1>Tiến Lên Miền Nam</h1><p>13 lá bài. Bốn ghế. Ai hết bài trước?</p></div><Button className='sp-btn' onClick={() => setRulesOpen(true)}>Xem luật</Button></div>
      <p className='thirteen-stake'>Cược {config.stake} PC/người khi có từ 2 người thật. Chơi một mình miễn phí; bot lấp ghế trống.</p>
      {playing ? <details className='thirteen-table-switcher'><summary>Bàn khác · Bạn đang ở bàn {currentTable.tableId}</summary>{lobby}</details> : lobby}
      {!tables.length && <p role='status'>Đang tải bàn chơi...</p>}
      {seated && <ThirteenTable3D table={currentTable} myHand={state.myHand} selectedCards={state.selectedCards} toggleCard={state.toggleCard} userId={user?._id} />}
      <ThirteenHud {...state} table={seated ? currentTable : null} userId={user?._id} />
    </main>
    <ThirteenRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
  </div>
}
export default function ThirteenPage() { return <ThirteenProvider><ThirteenContent /></ThirteenProvider> }
