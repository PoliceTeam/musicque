import React, { useCallback, useEffect, useRef, useState } from 'react'
import { message, Modal } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  acceptJungleDraw,
  cancelJungleGame,
  createJunglePractice,
  declineJungleDraw,
  offerJungleDraw,
  playJungleMove,
  resignJungleGame,
} from '../../services/api'
import {
  PIECES,
  SIDE_LABEL,
  capturedPieces,
  clockRemaining,
  describeResult,
  formatClock,
  mySideOf,
} from '../../utils/jungle'
import JungleBoard3D, { JungleLoading } from './JungleBoard3D'
import { iconUrl } from './jungleAssets'
import { useJungleGame, useNow } from './useJungle'

const errorText = (error) => error.response?.data?.message || 'Có lỗi xảy ra, thử lại nhé'
const LOW_TIME_MS = 60_000

const PlayerCard = ({ game, side, isMe, receivedAt, now, lost }) => {
  const player = game[side]
  const running = game.status === 'playing' && game.board?.turn === side
  const remaining = clockRemaining(game.clock, side, receivedAt, now)
  const away = game.away?.[side]
  const awayLeft = away ? Math.max(0, game.disconnectMs - (now - Date.parse(away))) : null
  return (
    <div className={`jg-player is-${side}${running ? ' is-turn' : ''}${isMe ? ' is-me' : ''}`}>
      <div className='jg-player__id'>
        <span className='jg-player__swatch' />
        <div>
          <strong>{player?.displayName || 'Đang chờ…'}{isMe && <em> · bạn</em>}</strong>
          <small>Phe {SIDE_LABEL[side]}{running ? ' · đang đi' : ''}</small>
        </div>
        {game.clock && (
          <span className={`jg-clock${running ? ' is-running' : ''}${remaining !== null && remaining < LOW_TIME_MS ? ' is-low' : ''}`}>
            {formatClock(remaining)}
          </span>
        )}
      </div>
      {awayLeft !== null && (
        <p className='jg-player__away'>Mất kết nối · xử thua sau {formatClock(awayLeft)}</p>
      )}
      <div className='jg-player__lost' aria-label='Quân đã mất'>
        {lost.length === 0 && <span className='jg-player__none'>Chưa mất quân nào</span>}
        {lost.map((type) => (
          <img key={type} src={iconUrl(type)} alt={PIECES[type].name} title={PIECES[type].name} className={`is-${type}`} />
        ))}
      </div>
    </div>
  )
}

const MoveLog = ({ moves }) => {
  const ref = useRef()
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [moves.length])
  if (!moves.length) return <p className='jg-empty'>Chưa có nước nào.</p>
  return (
    <ol className='jg-log' ref={ref}>
      {moves.map((move) => (
        <li key={move.ply} className={`is-${move.side}`}>
          <span className='jg-log__ply'>{move.ply}</span>
          <img src={iconUrl(move.piece)} alt='' className={`is-${move.piece}`} />
          <span>
            {PIECES[move.piece]?.name} {move.from}→{move.to}
            {move.jump && ' 🦘'}
            {move.captured && <b> ăn {PIECES[move.captured]?.name}</b>}
          </span>
        </li>
      ))}
    </ol>
  )
}

const ResultOverlay = ({ game, mySide, onClose, onRematch }) => {
  const navigate = useNavigate()
  const view = describeResult(game.result, mySide)
  if (!view) return null
  const payout = mySide && game.payouts?.find((p) => p.userId === game[mySide]?.userId)
  return (
    <div className={`jg-result is-${view.tone}`} role='dialog' aria-live='polite'>
      <span className='jg-result__icon'>{view.tone === 'win' ? '🏆' : view.tone === 'lose' ? '🍃' : view.tone === 'draw' ? '🤝' : '🏁'}</span>
      <h2>{view.title}</h2>
      <p>Vì {view.detail}.</p>
      {game.mode === 'pvp' && mySide && (
        <p className='jg-result__coins'>
          {view.tone === 'win' && `+${payout?.amount ?? game.stake * 2} PC về ví`}
          {view.tone === 'draw' && `Hoàn ${game.stake} PC tiền cược`}
          {view.tone === 'lose' && `Mất ${game.stake} PC tiền cược`}
        </p>
      )}
      <div className='jg-result__actions'>
        {game.mode === 'practice' && mySide && <button type='button' className='jg-btn jg-btn--practice' onClick={onRematch}>Ván tập mới</button>}
        <button type='button' className='jg-btn jg-btn--primary' onClick={() => navigate('/jungle')}>Về sảnh</button>
        <button type='button' className='jg-btn jg-btn--ghost' onClick={onClose}>Xem lại bàn</button>
      </div>
    </div>
  )
}

const JungleGameView = ({ gameId }) => {
  const navigate = useNavigate()
  const { user, refreshBalance } = useAuth()
  const { game, receivedAt, error, apply } = useJungleGame(gameId)
  const now = useNow(250)
  const [busy, setBusy] = useState(false)
  const [resultHidden, setResultHidden] = useState(false)
  const settledRef = useRef(null)

  const mySide = mySideOf(game, user?._id)
  const playing = game?.status === 'playing'
  const myTurn = playing && mySide && game.board?.turn === mySide

  useEffect(() => {
    if (game?.status === 'finished' && settledRef.current !== game.id) {
      settledRef.current = game.id
      refreshBalance()
    }
  }, [game?.status, game?.id, refreshBalance])

  useEffect(() => { setResultHidden(false) }, [gameId])

  const call = useCallback(async (request, { silent = false } = {}) => {
    setBusy(true)
    try {
      const { data } = await request()
      apply(data.game)
      return true
    } catch (err) {
      if (!silent) message.error(errorText(err))
      return false
    } finally {
      setBusy(false)
    }
  }, [apply])

  const onMove = useCallback(async (from, to) => {
    try {
      const { data } = await playJungleMove(gameId, { from, to, ply: game?.board?.ply })
      apply(data.game)
      return true
    } catch (err) {
      message.warning({ content: errorText(err), key: 'jg-move' })
      return false
    }
  }, [gameId, game?.board?.ply, apply])

  const rematch = async () => {
    const level = game?.bot?.level || 'medium'
    try {
      const { data } = await createJunglePractice({ level, side: mySide || undefined })
      navigate(`/jungle/${data.game.id}`)
    } catch (err) {
      message.error(errorText(err))
    }
  }

  const confirmResign = () => Modal.confirm({
    title: 'Đầu hàng ván này?',
    content: game.mode === 'pvp' ? `Bạn sẽ mất ${game.stake} PC tiền cược.` : 'Ván tập sẽ kết thúc.',
    okText: 'Đầu hàng',
    okButtonProps: { danger: true },
    cancelText: 'Chơi tiếp',
    onOk: () => call(() => resignJungleGame(gameId)),
  })

  if (error && !game) {
    return (
      <div className='jg-state'>
        <p>{error}</p>
        <button type='button' className='jg-btn jg-btn--primary' onClick={() => navigate('/jungle')}>Về sảnh</button>
      </div>
    )
  }
  if (!game) return <div className='jg-state'><p>Đang mở bàn cờ…</p></div>

  if (game.status === 'waiting' || game.status === 'cancelled') {
    const isHost = game.host?.userId === String(user?._id)
    return (
      <div className='jg-state jg-waiting'>
        <div className='jg-waiting__pets' aria-hidden='true'>
          {['cat', 'dog', 'rat'].map((type, i) => <img key={type} src={iconUrl(type)} alt='' style={{ '--i': i }} />)}
        </div>
        {game.status === 'cancelled' ? (
          <>
            <h2>Bàn đã huỷ</h2>
            <p>Không ai bị trừ PC.</p>
          </>
        ) : (
          <>
            <h2>Đang chờ đối thủ…</h2>
            <p>Bàn của <b>{game.host?.displayName}</b> · cược {game.stake} PC mỗi bên. Gửi link trang này cho đồng nghiệp để họ vào đấu.</p>
            <p className='jg-waiting__hint'>Trong lúc chờ, bạn có thể mở tab khác để tập với máy — nhưng giữ tab này mở, bàn tự huỷ nếu bạn rời quá 1 phút.</p>
          </>
        )}
        <div className='jg-result__actions'>
          {isHost && game.status === 'waiting' && (
            <button type='button' className='jg-btn jg-btn--ghost' disabled={busy} onClick={() => call(() => cancelJungleGame(gameId))}>Huỷ bàn</button>
          )}
          <button type='button' className='jg-btn jg-btn--primary' onClick={() => navigate('/jungle')}>Về sảnh</button>
        </div>
      </div>
    )
  }

  const viewer = mySide || 'red'
  const opponent = viewer === 'red' ? 'blue' : 'red'
  const lost = capturedPieces(game.board?.pieces)
  const offerFromOpponent = playing && mySide && game.drawOfferBy === opponent
  const myOfferPending = playing && mySide && game.drawOfferBy === mySide

  let status
  if (!playing) status = 'Ván đã kết thúc'
  else if (!mySide) status = `Đang xem · lượt phe ${SIDE_LABEL[game.board.turn]}`
  else if (myTurn) status = 'Đến lượt bạn — chọn một quân'
  else status = game.mode === 'practice' ? 'Máy đang nghĩ…' : 'Đang chờ đối thủ đi…'

  return (
    <div className='jg-game'>
      <div className='jg-stage'>
        <JungleBoard3D game={game} mySide={mySide} canAct={Boolean(myTurn) && !busy} onMove={onMove} />
        <JungleLoading />
        <div className={`jg-turn${myTurn ? ' is-mine' : ''}`}>{status}</div>
        {offerFromOpponent && (
          <div className='jg-offer'>
            <span>🤝 Đối thủ đề nghị hòa</span>
            <button type='button' className='jg-btn jg-btn--small jg-btn--primary' disabled={busy} onClick={() => call(() => acceptJungleDraw(gameId))}>Đồng ý</button>
            <button type='button' className='jg-btn jg-btn--small jg-btn--ghost' disabled={busy} onClick={() => call(() => declineJungleDraw(gameId))}>Từ chối</button>
          </div>
        )}
        {game.result && !resultHidden && (
          <ResultOverlay game={game} mySide={mySide} onClose={() => setResultHidden(true)} onRematch={rematch} />
        )}
        <p className='jg-stage__hint'>Kéo để xoay bàn · cuộn để phóng to · Esc để bỏ chọn</p>
      </div>

      <aside className='jg-side'>
        <PlayerCard game={game} side={opponent} isMe={false} receivedAt={receivedAt} now={now} lost={lost[opponent]} />
        <div className='jg-side__log'>
          <h3>Diễn biến{game.board && <small> · {game.board.pliesSinceCapture}/100 nước chưa ăn quân</small>}</h3>
          <MoveLog moves={game.moves || []} />
        </div>
        <PlayerCard game={game} side={viewer} isMe={Boolean(mySide)} receivedAt={receivedAt} now={now} lost={lost[viewer]} />
        {playing && mySide && (
          <div className='jg-side__actions'>
            {game.mode === 'pvp' && (
              <button type='button' className='jg-btn jg-btn--ghost' disabled={busy || myOfferPending} onClick={() => call(() => offerJungleDraw(gameId))}>
                {myOfferPending ? 'Đã đề nghị hòa' : 'Đề nghị hòa'}
              </button>
            )}
            <button type='button' className='jg-btn jg-btn--danger' disabled={busy} onClick={confirmResign}>Đầu hàng</button>
          </div>
        )}
        {!playing && resultHidden && (
          <div className='jg-side__actions'>
            {game.mode === 'practice' && mySide && <button type='button' className='jg-btn jg-btn--practice' onClick={rematch}>Ván tập mới</button>}
            <button type='button' className='jg-btn jg-btn--primary' onClick={() => navigate('/jungle')}>Về sảnh</button>
          </div>
        )}
      </aside>
    </div>
  )
}

export default JungleGameView
