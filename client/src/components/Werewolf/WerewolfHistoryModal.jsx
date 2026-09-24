import React, { useEffect, useState } from 'react'
import { Modal } from 'antd'
import UserAvatar from '../Avatar/UserAvatar'
import { getWerewolfHistory } from '../../services/api'
import { describeFate, isWolfRole, roleMeta, sortHistoryPlayers } from '../../utils/werewolf'

const RESULT_ICON = { village: '🏡', wolf: '🐺', killer: '🔪', arsonist: '🔥', cult: '👤', tanner: '👺', lovers: '💞', none: '🪦' }

const formatWhen = (value) => {
  if (!value) return ''
  const date = new Date(value)
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000)
  if (minutes < 1) return 'vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} giờ trước`
  return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const RoleCell = ({ catalog, player }) => {
  const role = roleMeta(catalog, player.role)
  const original = player.originalRole && player.originalRole !== player.role ? roleMeta(catalog, player.originalRole) : null
  return (
    <span className={`ww-history__role${isWolfRole(player.role) ? ' is-wolf' : ''}`}>
      {role ? `${role.emoji} ${role.name}` : player.role}
      {original && <small> (vốn là {original.emoji} {original.name})</small>}
    </span>
  )
}

const GameCard = ({ game, catalog, myId, defaultOpen }) => {
  const lovers = new Set(game.players.filter((p) => p.loverId).map((p) => p.userId))
  const mine = game.players.find((p) => p.userId === myId)
  return (
    <details className={`ww-history__game is-${game.winnerTeam}`} open={defaultOpen}>
      <summary>
        <span className='ww-history__icon'>{RESULT_ICON[game.winnerTeam] || '🏁'}</span>
        <span className='ww-history__headline'>
          <strong>{game.teamLabel}{game.winnerTeam === 'none' ? '' : ' thắng'}</strong>
          <small>
            {formatWhen(game.endedAt)} · {game.days} ngày · {game.players.length} người
            {game.hasBots ? ' · có bot' : ''}
          </small>
        </span>
        {mine && (
          <span className={`ww-history__me${mine.winner ? ' is-win' : ''}`}>
            {mine.winner ? `🏆 Bạn thắng${mine.reward ? ` +${mine.reward} PC` : ''}` : 'Bạn thua'}
          </span>
        )}
      </summary>
      <ul className='ww-history__players'>
        {sortHistoryPlayers(game.players).map((player) => (
          <li key={player.userId} className={`${player.alive ? '' : 'is-dead'}${player.userId === myId ? ' is-me' : ''}`}>
            <UserAvatar user={player} name={player.displayName} avatarId={player.avatarId} size={26} />
            <span className='ww-history__name'>
              {player.displayName}
              {lovers.has(player.userId) && <span title='Đôi tình nhân'> 💞</span>}
            </span>
            <RoleCell catalog={catalog} player={player} />
            <span className='ww-history__fate'>{describeFate(player)}</span>
            <span className='ww-history__result'>{player.winner ? '🏆' : ''}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}

// Xem lại vai của mọi người ở các ván gần nhất — màn kết quả cuối ván biến mất khá nhanh.
const WerewolfHistoryModal = ({ open, onClose, catalog, myId }) => {
  const [games, setGames] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    let active = true
    setError(false)
    getWerewolfHistory(5)
      .then(({ data }) => active && setGames(data.games))
      .catch(() => active && setError(true))
    return () => { active = false }
  }, [open])

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={760} title='📜 Lịch sử 5 ván gần nhất' className='ww-history'>
      {error && <p className='ww-history__empty'>Không tải được lịch sử, thử lại sau nhé.</p>}
      {!error && !games && <p className='ww-history__empty'>Đang lật lại hồ sơ…</p>}
      {!error && games?.length === 0 && <p className='ww-history__empty'>Chưa có ván nào kết thúc.</p>}
      {games?.map((game, index) => (
        <GameCard key={game.id} game={game} catalog={catalog} myId={myId} defaultOpen={index === 0} />
      ))}
    </Modal>
  )
}

export default WerewolfHistoryModal
