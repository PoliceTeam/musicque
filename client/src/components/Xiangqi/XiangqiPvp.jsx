import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import { useAuth } from '../../contexts/AuthContext'
import { PlaylistContext } from '../../contexts/PlaylistContext'
import { actionXiangqiPvp, createXiangqiPvp, getActiveXiangqiPvp, getXiangqiPvp, joinXiangqiPvp, moveXiangqiPvp } from '../../services/api'
import XiangqiBoard from './XiangqiBoard'

const errorText = (error) => error.response?.data?.message || 'Không kết nối được phòng cờ'

const XiangqiPvp = () => {
  const { user, requireAuth, refreshBalance } = useAuth()
  const { socket } = useContext(PlaylistContext)
  const [game, setGame] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncError, setSyncError] = useState(false)
  const current = useRef(null)
  const generation = useRef(0)

  const accept = useCallback((next) => {
    if (next && current.current?.id === next.id && next.plyVersion < current.current.plyVersion) return
    current.current = next
    setGame(next)
    setSyncError(false)
  }, [])

  useEffect(() => {
    const epoch = ++generation.current
    accept(null)
    setLoading(true)
    const restore = user ? getActiveXiangqiPvp() : Promise.resolve({ data: { game: null } })
    restore.then(({ data }) => { if (generation.current === epoch) accept(data.game) })
      .catch((error) => { if (generation.current === epoch) message.error(errorText(error)) })
      .finally(() => { if (generation.current === epoch) setLoading(false) })
    return () => { generation.current = epoch + 1 }
  }, [user?._id, accept]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    const id = current.current?.id
    const epoch = generation.current
    if (!id) return
    try {
      const { data } = await getXiangqiPvp(id)
      if (generation.current === epoch && current.current?.id === id) accept(data.game)
    } catch {
      if (generation.current === epoch) setSyncError(true)
    }
  }, [accept])

  useEffect(() => {
    if (!game || (!['waiting', 'starting', 'playing'].includes(game.status) && !game.settlementPending)) return undefined
    const changed = ({ id }) => { if (id === current.current?.id) refresh() }
    socket?.on('xiangqi:pvp_updated', changed)
    socket?.on('connect', refresh)
    // Đồng bộ dự phòng khi socket mất kết nối hoặc bỏ lỡ thông báo.
    const timer = window.setInterval(refresh, 3000)
    window.addEventListener('focus', refresh)
    return () => {
      socket?.off('xiangqi:pvp_updated', changed)
      socket?.off('connect', refresh)
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [game?.id, game?.status, socket, refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (game) refreshBalance()
  }, [game?.id, game?.status, game?.settlementPending, refreshBalance]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (operation) => {
    if (busy || !requireAuth('chơi cờ tướng với bạn bè')) return
    const epoch = generation.current
    setBusy(true)
    try {
      const { data } = await operation()
      if (generation.current === epoch) accept(data.game)
    } catch (error) {
      if (generation.current === epoch) {
        message.error(errorText(error))
        await refresh()
      }
    } finally { refreshBalance(); setBusy(false) }
  }
  const act = (action) => run(() => actionXiangqiPvp(game.id, action, game.plyVersion))
  const copy = async () => {
    try { await navigator.clipboard.writeText(game.code); message.success('Đã sao chép mã phòng') }
    catch { message.info(`Mã phòng: ${game.code}`) }
  }

  if (loading) return <div className='xiangqi-loading'>Đang tìm phòng của bạn...</div>
  if (!game) return (
    <section className='xiangqi-lobby'>
      <span className='xiangqi-eyebrow'>ĐẤU VỚI BẠN BÈ</span>
      <h1>Cờ tướng PvP</h1>
      <p>Hai người, một bàn cờ đầy đủ. Đỏ đi trước. Mỗi bên cược 30 PC, người thắng nhận 60 PC (lãi 30 PC). Hòa hoàn cược cho cả hai. Không giới hạn thời gian.</p>
      <button type='button' className='sp-btn sp-btn--primary' disabled={busy} onClick={() => run(createXiangqiPvp)}>Tạo phòng</button>
      <form className='xiangqi-pvp-join' onSubmit={(event) => { event.preventDefault(); run(() => joinXiangqiPvp(code)) }}>
        <label htmlFor='xiangqi-room-code'>Hoặc nhập mã phòng của bạn bè</label>
        <input id='xiangqi-room-code' value={code} maxLength={8} placeholder='Mã 8 ký tự' autoComplete='off' onChange={(event) => setCode(event.target.value.toUpperCase())} />
        <button type='submit' className='sp-btn' disabled={busy || code.trim().length !== 8}>Vào phòng</button>
      </form>
    </section>
  )
  const playing = game.status === 'playing'
  const waiting = game.status === 'waiting'
  const starting = game.status === 'starting'
  const myTurn = playing && game.turn === game.myColor
  const opponentOffer = game.drawOfferedBy && game.drawOfferedBy !== game.myColor
  const result = game.status === 'cancelled' ? 'Đã hủy phòng' : game.winner === 'draw' ? 'Ván cờ hòa'
    : game.winner === game.myColor ? 'Bạn đã thắng!' : 'Đối thủ đã thắng'

  return (
    <div className='xiangqi-game-layout'>
      <section className='xiangqi-board-wrap'>
        <XiangqiBoard key={`${game.id}-${game.plyVersion}`} game={game} playerColor={game.myColor} disabled={busy || !myTurn || syncError} onMove={(from, to) => run(() => moveXiangqiPvp(game.id, from, to, game.plyVersion))} />
      </section>
      <aside className='xiangqi-game-panel'>
        <span className='xiangqi-eyebrow'>PHÒNG PvP · CƯỢC {game.stake} PC MỖI BÊN</span>
        <div className='xiangqi-pvp-code'><strong>{game.code}</strong><button type='button' className='xiangqi-link-btn' onClick={copy}>Sao chép mã</button></div>
        <p>🔴 {game.red}{game.myColor === 'r' ? ' (Bạn)' : ''}</p>
        <p>⚫ {game.black || 'Đang chờ đối thủ...'}{game.myColor === 'b' ? ' (Bạn)' : ''}</p>
        {syncError && <p role='alert'>Kết nối bị gián đoạn. Đang đồng bộ lại ván cờ...</p>}
        <div className='xiangqi-pot'><span>Cược mỗi người</span><strong>{game.stake} PC</strong></div>
        <div className='xiangqi-pot xiangqi-pot--reward'><span>Người thắng nhận</span><strong>{waiting || starting ? game.stake * 2 : game.pot} PC</strong></div>
        {starting && <p>Đang thu cược hai bên để bắt đầu ván...</p>}
        {waiting && <p>Gửi mã phòng cho bạn bè. Ván đấu bắt đầu khi người thứ hai vào và cả hai đủ {game.stake} PC. Chỉ thu cược khi bắt đầu.</p>}
        {playing && <>
          <div className='xiangqi-turn'><span className='xiangqi-turn__dot' />{myTurn ? 'Đến lượt bạn' : 'Đến lượt đối thủ'}{game.inCheck ? ' · Chiếu!' : ''}</div>
          <p>Bạn cầm quân {game.myColor === 'r' ? 'Đỏ' : 'Đen'}. Nước đã đi: {game.moveCount ?? 0}.</p>
          {opponentOffer ? <div className='xiangqi-tools'>
            <p>Đối thủ đề nghị hòa.</p>
            <button type='button' disabled={busy} onClick={() => act('accept_draw')}>Đồng ý hòa</button>
            <button type='button' disabled={busy} onClick={() => act('decline_draw')}>Tiếp tục đấu</button>
          </div> : <button type='button' className='sp-btn' disabled={busy || Boolean(game.drawOfferedBy)} onClick={() => act('offer_draw')}>{game.drawOfferedBy ? 'Đang chờ đối thủ đồng ý hòa' : 'Đề nghị hòa'}</button>}
        </>}
        {(waiting || playing) ? <button type='button' className='xiangqi-resign' disabled={busy} onClick={() => {
          if (waiting || window.confirm(`Xin thua sẽ mất ${game.stake} PC đã cược. Bạn muốn kết thúc ván đấu?`)) act('resign')
        }}>{waiting ? 'Hủy phòng' : 'Xin thua'}</button> : starting ? null : <div className='xiangqi-result'>
          <h2>{result}</h2>
          <p>{game.resultReason === 'resigned' ? 'Ván đấu kết thúc do xin thua.' : game.resultReason === 'agreement' ? 'Hai bên đã đồng ý hòa.' : game.resultReason === 'checkmate' ? 'Chiếu hết.' : game.resultReason === 'no_legal_moves' ? 'Không còn nước đi hợp lệ.' : ''}</p>
          {game.settlementPending ? <p>Đang xử lý trả thưởng / hoàn cược...</p>
            : game.funded && game.stake > 0 && <p>{game.status === 'cancelled' || game.winner === 'draw' ? `Đã hoàn ${game.stake} PC tiền cược.` : game.winner === game.myColor ? `Nhận ${game.pot} PC · lãi ${game.stake} PC.` : `Đã mất ${game.stake} PC tiền cược.`}</p>}
          {game.resultReason === 'funding_failed' && <p>Không thu đủ cược hai bên. Phòng đã hủy; phần đã thu được hoàn lại.</p>}
          <button type='button' className='sp-btn sp-btn--primary' disabled={game.settlementPending} onClick={() => accept(null)}>Về sảnh PvP</button>
        </div>}
      </aside>
    </div>
  )
}
export default XiangqiPvp
