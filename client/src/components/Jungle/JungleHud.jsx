import React from 'react'
import { PIECES, SIDE_LABEL, clockRemaining, formatClock } from '../../utils/jungle'
import { iconUrl } from './jungleAssets'

const LOW_TIME_MS = 60_000

// HUD gọn của một người chơi nổi trên khung 3D. `corner` = 'top-left' (đối thủ) | 'bottom-right' (bạn).
const JunglePlayerHud = ({ game, side, isMe, corner, receivedAt, now, lost }) => {
  const player = game[side]
  const playing = game.status === 'playing'
  const myTurn = playing && game.board?.turn === side
  const remaining = clockRemaining(game.clock, side, receivedAt, now)
  const ratio = remaining !== null && game.clockMs ? Math.max(0, Math.min(1, remaining / game.clockMs)) : null
  const low = remaining !== null && remaining < LOW_TIME_MS
  const away = game.away?.[side]
  const awayLeft = away ? Math.max(0, game.disconnectMs - (now - Date.parse(away))) : null
  const isBot = Boolean(player?.isBot)

  let state = 'Chờ'
  if (!playing) state = game.result?.winner === side ? 'Thắng' : game.result?.winner ? 'Thua' : 'Hòa'
  else if (myTurn) state = isBot ? 'Đang nghĩ…' : isMe ? 'Lượt bạn' : 'Đang đi'

  return (
    <div
      className={`jg-hud is-${corner} is-${side}${myTurn ? ' is-turn' : ''}${low && myTurn ? ' is-low' : ''}`}
      aria-label={`${isMe ? 'Bạn' : 'Đối thủ'} · phe ${SIDE_LABEL[side]}`}
    >
      <div className='jg-hud__row'>
        <span className='jg-hud__avatar' aria-hidden='true'>{isBot ? '🤖' : (player?.displayName || '?').trim().charAt(0).toUpperCase()}</span>
        <div className='jg-hud__who'>
          <span className='jg-hud__tag'>{isMe ? 'Bạn' : 'Đối thủ'} · {SIDE_LABEL[side]}</span>
          <strong>{player?.displayName || 'Đang chờ…'}</strong>
        </div>
        <span className='jg-hud__time' title={remaining === null ? 'Không giới hạn giờ' : 'Thời gian còn lại'}>
          {remaining === null ? '∞' : formatClock(remaining)}
        </span>
      </div>

      {ratio !== null && <span className='jg-hud__bar' aria-hidden='true'><span style={{ width: `${ratio * 100}%` }} /></span>}

      <div className='jg-hud__foot'>
        <span className={`jg-hud__state${myTurn ? ' is-on' : ''}`}>
          {myTurn && <i aria-hidden='true' />}
          {state}
        </span>
        <span className='jg-hud__lost' aria-label='Quân đã mất' title='Quân đã mất'>
          {lost.map((type) => (
            <img key={type} src={iconUrl(type)} alt={PIECES[type].name} title={PIECES[type].name} className={`is-${type}`} />
          ))}
        </span>
      </div>

      {awayLeft !== null && <p className='jg-hud__away'>⚠️ Mất kết nối · thua sau {formatClock(awayLeft)}</p>}
    </div>
  )
}

export default JunglePlayerHud
