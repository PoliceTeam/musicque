import React from 'react'
import UserAvatar from '../Avatar/UserAvatar'
import { ACTION_VERB, isWolfRole, roleMeta, tallyVotes } from '../../utils/werewolf'

const PlayerCard = ({ player, catalog, state, targetable, selected, wolfPicks, cultPicks, votesReceived, onPick }) => {
  const role = roleMeta(catalog, player.role)
  const isMe = state.me?.userId === player.userId
  const votedFor = player.vote && player.vote !== 'skip'
    ? state.players.find((p) => p.userId === player.vote)?.displayName
    : player.vote === 'skip' ? 'Bỏ qua' : null
  const classes = [
    'ww-card',
    !player.alive && 'is-dead',
    isMe && 'is-me',
    targetable && 'is-targetable',
    selected && 'is-selected',
    player.winner && 'is-winner',
    role && isWolfRole(player.role) && 'is-wolf',
  ].filter(Boolean).join(' ')

  const body = (
    <>
      <div className='ww-card__avatar'>
        <UserAvatar user={player} name={player.displayName} avatarId={player.avatarId} size={44} />
        {!player.alive && <span className='ww-card__tomb' aria-label='Đã chết'>🪦</span>}
        {player.lover && <span className='ww-card__lover' title='Đôi tình nhân'>💞</span>}
      </div>
      <div className='ww-card__name' title={player.displayName}>
        {player.displayName}
        {isMe && <small> (bạn)</small>}
      </div>
      <div className='ww-card__role'>
        {role ? <span>{role.emoji} {role.name}</span> : state.status === 'lobby' ? (player.isHost ? '👑 Chủ phòng' : player.isBot ? 'Bot' : 'Sẵn sàng') : <span className='ww-card__unknown'>{player.alive ? 'Vai ẩn' : 'Lật vai cuối ván'}</span>}
      </div>
      <div className='ww-card__badges'>
        {player.ready && <span className='ww-badge ww-badge--ready'>✓ Sẵn sàng</span>}
        {votedFor && <span className='ww-badge'>→ {votedFor}</span>}
        {votesReceived > 0 && <span className='ww-badge ww-badge--votes'>{votesReceived} phiếu</span>}
        {wolfPicks > 0 && <span className='ww-badge ww-badge--wolf'>🐺 ×{wolfPicks}</span>}
        {cultPicks > 0 && <span className='ww-badge ww-badge--cult'>👤 ×{cultPicks}</span>}
        {state.me?.doused?.includes(player.userId) && <span className='ww-badge ww-badge--fuel'>⛽ Đã tưới</span>}
        {state.me?.modelId === player.userId && <span className='ww-badge'>🧬 Hình mẫu</span>}
        {player.winner && <span className='ww-badge ww-badge--win'>🏆 Thắng</span>}
      </div>
    </>
  )

  if (!targetable) return <div className={classes}>{body}</div>
  return (
    <button type='button' className={classes} onClick={() => onPick(player.userId)} aria-pressed={selected}>
      {body}
    </button>
  )
}

const PlayerGrid = ({ state, catalog, selectedIds, onPick }) => {
  const action = state.me?.action
  const targets = new Set(action?.targets || [])
  const votes = state.phase === 'vote' ? tallyVotes(state.players) : {}
  // Đồng bọn đang chọn ai (bầy sói / giáo phái) — chỉ server gửi cho đúng người trong nhóm
  const countPicks = (votes = []) => votes.reduce((acc, vote) => {
    const picked = [vote.targetId, vote.targetId2].filter(Boolean)
    picked.forEach((id) => { acc[id] = (acc[id] || 0) + 1 })
    return acc
  }, {})
  const wolfPicks = countPicks(state.me?.wolfVotes || [])
  const cultPicks = countPicks(state.me?.cultVotes || [])

  return (
    <section className='ww-grid' aria-label='Người chơi'>
      {action?.targets && (
        <p className='ww-grid__hint'>
          Chạm vào một người để <strong>{ACTION_VERB[action.kind]?.toLowerCase()}</strong>
          {action.needsTwo ? ' (chọn đủ hai người)' : ''}.
          {action.kind.endsWith('_shot') ? ' Bắn là không rút lại được!' : ' Có thể đổi ý tới khi hết giờ.'}
        </p>
      )}
      <div className='ww-grid__cards'>
        {state.players.map((player) => (
          <PlayerCard
            key={player.userId}
            player={player}
            catalog={catalog}
            state={state}
            targetable={targets.has(player.userId)}
            selected={selectedIds.includes(player.userId)}
            wolfPicks={wolfPicks[player.userId] || 0}
            cultPicks={cultPicks[player.userId] || 0}
            votesReceived={votes[player.userId]?.length || 0}
            onPick={onPick}
          />
        ))}
      </div>
    </section>
  )
}

export default PlayerGrid
