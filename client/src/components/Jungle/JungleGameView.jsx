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
  describeResult,
  mySideOf,
  pieceId,
} from '../../utils/jungle'
import JungleBoard3D, { JungleLoading } from './JungleBoard3D'
import JunglePlayerHud from './JungleHud'
import JunglePieceCard from './JunglePieceCard'
import { iconUrl } from './jungleAssets'
import { useJungleGame, useNow } from './useJungle'

const errorText = (error) => error.response?.data?.message || 'Có lỗi xảy ra, thử lại nhé'

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
  const [inspectedId, setInspectedId] = useState(null)
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

  useEffect(() => {
    setResultHidden(false)
    setInspectedId(null)
  }, [gameId])

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') setInspectedId(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
  const inspected = inspectedId ? game.board?.pieces.find((piece) => pieceId(piece) === inspectedId) || null : null
  const inspectedMoves = inspected && myTurn && inspected.side === mySide
    ? (game.board?.legalMoves || []).filter((move) => move.from === inspected.square).length
    : null
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
        <JungleBoard3D
          game={game}
          mySide={mySide}
          canAct={Boolean(myTurn) && !busy}
          onMove={onMove}
          inspectedId={inspected ? inspectedId : null}
          onInspect={setInspectedId}
        />
        <JungleLoading />
        <JunglePlayerHud game={game} side={opponent} isMe={false} corner='top-left' receivedAt={receivedAt} now={now} lost={lost[opponent]} />
        <JunglePlayerHud game={game} side={viewer} isMe={Boolean(mySide)} corner='bottom-right' receivedAt={receivedAt} now={now} lost={lost[viewer]} />
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
        <p className='jg-stage__hint'>Bấm quân để xem thông tin · kéo xoay bàn · cuộn phóng to</p>
      </div>

      <aside className='jg-side'>
        {inspected ? (
          <JunglePieceCard piece={inspected} mySide={mySide} moveCount={inspectedMoves} onClose={() => setInspectedId(null)} />
        ) : (
          <p className='jg-side__tip'>💡 Bấm vào bất kỳ quân nào trên bàn để xem nó là con gì, ăn được ai và có năng lực gì.</p>
        )}
        <div className='jg-side__log'>
          <h3>Diễn biến{game.board && <small> · {game.board.pliesSinceCapture}/100 nước chưa ăn quân</small>}</h3>
          <MoveLog moves={game.moves || []} />
        </div>
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
