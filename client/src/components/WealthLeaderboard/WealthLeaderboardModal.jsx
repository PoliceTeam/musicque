import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { CrownOutlined, ReloadOutlined, TrophyOutlined } from '@ant-design/icons'
import { Modal } from 'antd'
import { useAuth } from '../../contexts/AuthContext'
import { getCoinLeaderboard } from '../../services/api'
import { getAvatarColor, getInitials } from '../../utils/avatar'

const PODIUM_ORDER = [2, 1, 3]
const numberFormatter = new Intl.NumberFormat('vi-VN')

const CoinBalance = ({ balance, compact = false }) => (
  <span className={`wealth-balance${compact ? ' wealth-balance--compact' : ''}`}>
    <img src='/dice/coin.png' alt='' aria-hidden='true' />
    <strong>{numberFormatter.format(balance)}</strong>
    <span>PC</span>
  </span>
)

const PlayerAvatar = ({ player, rank }) => {
  const name = player.displayName || player.username

  return (
    <span
      className={`wealth-avatar wealth-avatar--rank-${rank}`}
      style={{ '--wealth-avatar-color': player.color || getAvatarColor(name) }}
      aria-hidden='true'
    >
      {getInitials(name)}
    </span>
  )
}

const PodiumPlayer = ({ player, currentUserId }) => {
  const rank = player.rank
  const isCurrentUser = String(player.userId) === String(currentUserId || '')

  return (
    <article
      className={`wealth-podium wealth-podium--rank-${rank}${isCurrentUser ? ' is-current-user' : ''}`}
    >
      <div className='wealth-podium__identity'>
        {rank === 1 && <CrownOutlined className='wealth-podium__crown' />}
        <PlayerAvatar player={player} rank={rank} />
        <span className='wealth-podium__name' title={player.displayName}>
          {player.displayName}
        </span>
        <span className='wealth-podium__username'>@{player.username}</span>
        {isCurrentUser && <span className='wealth-you-badge'>Bạn</span>}
      </div>

      <div className='wealth-podium__base'>
        <span className='wealth-podium__rank'>#{rank}</span>
        <CoinBalance balance={player.balance} />
      </div>
    </article>
  )
}

const RankingRow = ({ player, currentUserId }) => {
  const isCurrentUser = String(player.userId) === String(currentUserId || '')

  return (
    <article className={`wealth-row${isCurrentUser ? ' is-current-user' : ''}`}>
      <span className='wealth-row__rank'>#{player.rank}</span>
      <PlayerAvatar player={player} rank={player.rank} />
      <span className='wealth-row__identity'>
        <strong>{player.displayName}</strong>
        <small>@{player.username}</small>
      </span>
      {isCurrentUser && <span className='wealth-you-badge'>Bạn</span>}
      <CoinBalance balance={player.balance} compact />
    </article>
  )
}

const WealthLeaderboardModal = ({ open, onClose }) => {
  const { user } = useAuth()
  const [leaders, setLeaders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadLeaderboard = useCallback(async (signal) => {
    setLoading(true)
    setError('')

    try {
      const { data } = await getCoinLeaderboard({ signal })
      setLeaders(Array.isArray(data.leaderboard) ? data.leaderboard : [])
    } catch (requestError) {
      if (requestError.code !== 'ERR_CANCELED') {
        setError(requestError.response?.data?.message || 'Không tải được bảng xếp hạng')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return undefined

    const controller = new AbortController()
    loadLeaderboard(controller.signal)
    return () => controller.abort()
  }, [loadLeaderboard, open])

  const podium = useMemo(
    () =>
      PODIUM_ORDER.map((rank) => leaders.find((player) => player.rank === rank)).filter(Boolean),
    [leaders],
  )
  const remaining = useMemo(() => leaders.filter((player) => player.rank > 3), [leaders])

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={null}
      width={760}
      centered
      className='wealth-modal'
      destroyOnHidden={false}
    >
      <div className='wealth-shell'>
        <header className='wealth-header'>
          <div className='wealth-header__emblem'>
            <img src='/dice/coin.png' alt='' aria-hidden='true' />
          </div>
          <div>
            <span className='wealth-header__eyebrow'>
              <TrophyOutlined />
              Polite Wealth League
            </span>
            <h2>Top đại phú</h2>
            <p>5 ví Polite Coins quyền lực nhất hệ thống</p>
          </div>
        </header>

        {loading && leaders.length === 0 ? (
          <div className='wealth-loading' role='status'>
            <img src='/dice/coin.png' alt='' aria-hidden='true' />
            <span>Đang kiểm kê kho báu...</span>
          </div>
        ) : error ? (
          <div className='wealth-error' role='alert'>
            <span>{error}</span>
            <button type='button' onClick={() => loadLeaderboard()}>
              <ReloadOutlined />
              Thử lại
            </button>
          </div>
        ) : leaders.length === 0 ? (
          <div className='wealth-empty'>Chưa có đại phú nào xuất hiện.</div>
        ) : (
          <>
            <section className='wealth-podiums' aria-label='Ba đại phú dẫn đầu'>
              {podium.map((player) => (
                <PodiumPlayer key={player.userId} player={player} currentUserId={user?._id} />
              ))}
            </section>

            {remaining.length > 0 && (
              <section className='wealth-ranking' aria-label='Hạng tư và hạng năm'>
                {remaining.map((player) => (
                  <RankingRow key={player.userId} player={player} currentUserId={user?._id} />
                ))}
              </section>
            )}
          </>
        )}

        <footer className='wealth-footer'>
          <span>Dữ liệu cập nhật mỗi lần mở bảng xếp hạng</span>
          <button
            type='button'
            className='wealth-refresh'
            onClick={() => loadLeaderboard()}
            disabled={loading}
            aria-label='Làm mới bảng xếp hạng'
          >
            <ReloadOutlined spin={loading} />
          </button>
        </footer>
      </div>
    </Modal>
  )
}

export default WealthLeaderboardModal
