import React, { useEffect, useState } from 'react'
import { message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  createJungleGame,
  createJunglePractice,
  getJungleActive,
  getJunglePracticeActive,
  joinJungleGame,
} from '../../services/api'
import { PIECES } from '../../utils/jungle'
import { iconUrl } from './jungleAssets'
import { useJungleLobby } from './useJungle'

const errorText = (error) => error.response?.data?.message || 'Có lỗi xảy ra, thử lại nhé'

const LEVEL_HINT = {
  easy: 'Đi khá tuỳ hứng, hợp để làm quen luật',
  medium: 'Biết ăn quân, biết giữ ổ, tính trước vài nước',
  hard: 'Tính sâu, ít khi để lọt sơ hở',
}
const SIDE_OPTIONS = [
  { key: 'random', label: 'Ngẫu nhiên' },
  { key: 'red', label: 'Đỏ · đi trước' },
  { key: 'blue', label: 'Xanh' },
]

const PlayerChip = ({ player }) => (
  <span className='jg-chip'>
    <i className='jg-chip__dot' />
    {player?.displayName || '—'}
  </span>
)

const JungleLobby = ({ config }) => {
  const navigate = useNavigate()
  const { user, balance, requireAuth, refreshBalance } = useAuth()
  const lobby = useJungleLobby()
  const [level, setLevel] = useState('medium')
  const [side, setSide] = useState('random')
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState({ pvp: null, practice: null })

  useEffect(() => {
    if (!user) {
      setActive({ pvp: null, practice: null })
      return
    }
    Promise.all([getJungleActive(), getJunglePracticeActive()])
      .then(([pvp, practice]) => setActive({ pvp: pvp.data.game, practice: practice.data.game }))
      .catch(() => {})
  }, [user])

  const run = async (request, reason) => {
    if (!requireAuth(reason)) return
    setBusy(true)
    try {
      const { data } = await request()
      refreshBalance()
      navigate(`/jungle/${data.game.id}`)
    } catch (error) {
      message.error(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  const stake = config?.stake ?? 100
  const levels = config?.botLevels || [{ key: 'easy', label: 'Dễ' }, { key: 'medium', label: 'Vừa' }, { key: 'hard', label: 'Khó' }]
  const otherRooms = lobby.waiting.filter((room) => room.host?.userId !== String(user?._id))
  const myRoom = lobby.waiting.find((room) => room.host?.userId === String(user?._id))

  return (
    <div className='jg-lobby'>
      <header className='jg-hero'>
        <div className='jg-hero__copy'>
          <span className='jg-eyebrow'>BOARD GAME 3D · 2 NGƯỜI</span>
          <h1>Cờ Thú</h1>
          <p>Voi to nhất nhưng sợ Chuột. Sư tử, Hổ nhảy qua sông. Ai đặt chân vào ổ đối phương trước thì thắng.</p>
        </div>
        <div className='jg-hero__pets' aria-hidden='true'>
          {['elephant', 'lion', 'tiger', 'rat'].map((type, i) => (
            <img key={type} src={iconUrl(type)} alt='' style={{ '--i': i }} className={`is-${type}`} />
          ))}
        </div>
      </header>

      {(active.pvp || active.practice) && (
        <div className='jg-resume'>
          {active.pvp && (
            <button type='button' className='jg-resume__item' onClick={() => navigate(`/jungle/${active.pvp.id}`)}>
              <strong>{active.pvp.status === 'waiting' ? 'Phòng của bạn đang chờ đối thủ' : 'Bạn đang có ván đấu dở'}</strong>
              <span>Quay lại bàn →</span>
            </button>
          )}
          {active.practice && (
            <button type='button' className='jg-resume__item is-practice' onClick={() => navigate(`/jungle/${active.practice.id}`)}>
              <strong>Ván tập với {active.practice.red?.isBot ? active.practice.red.displayName : active.practice.blue?.displayName}</strong>
              <span>Chơi tiếp →</span>
            </button>
          )}
        </div>
      )}

      <div className='jg-lobby__grid'>
        <section className='jg-card jg-card--pvp'>
          <div className='jg-card__head'>
            <h2>Đấu người</h2>
            <span className='jg-pill'>Cược {stake} PC · thắng nhận {stake * 2}</span>
          </div>
          <p className='jg-card__desc'>
            Mỗi bên {Math.round((config?.clockMs ?? 900000) / 60000)} phút. Bốc thăm ai cầm quân Đỏ đi trước.
            {user && <> Ví của bạn: <b>{balance} PC</b>.</>}
          </p>
          <button
            type='button'
            className='jg-btn jg-btn--primary'
            disabled={busy || Boolean(active.pvp)}
            onClick={() => run(createJungleGame, 'Đăng nhập để mở bàn Cờ thú')}
          >
            {myRoom ? 'Bạn đã mở bàn' : 'Mở bàn mới'}
          </button>

          <h3>Bàn đang chờ</h3>
          {otherRooms.length === 0 && <p className='jg-empty'>Chưa có ai mở bàn. Mở một bàn rồi rủ đồng nghiệp vào nhé!</p>}
          <ul className='jg-list'>
            {otherRooms.map((room) => (
              <li key={room.id}>
                <PlayerChip player={room.host} />
                <span className='jg-list__meta'>{room.stake} PC</span>
                <button
                  type='button'
                  className='jg-btn jg-btn--small'
                  disabled={busy || Boolean(active.pvp)}
                  onClick={() => run(() => joinJungleGame(room.id), 'Đăng nhập để vào bàn')}
                >
                  Vào đấu
                </button>
              </li>
            ))}
          </ul>

          {lobby.playing.length > 0 && (
            <>
              <h3>Đang diễn ra</h3>
              <ul className='jg-list'>
                {lobby.playing.map((game) => (
                  <li key={game.id}>
                    <PlayerChip player={game.red} />
                    <span className='jg-list__vs'>vs</span>
                    <PlayerChip player={game.blue} />
                    <span className='jg-list__meta'>nước {game.ply}</span>
                    <button type='button' className='jg-btn jg-btn--ghost jg-btn--small' onClick={() => navigate(`/jungle/${game.id}`)}>
                      Xem
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className='jg-card jg-card--practice'>
          <div className='jg-card__head'>
            <h2>Tập với máy</h2>
            <span className='jg-pill is-free'>Miễn phí</span>
          </div>
          <p className='jg-card__desc'>Không cược, không đồng hồ. Luyện tay trong lúc chờ người vào bàn.</p>

          <div className='jg-levels' role='radiogroup' aria-label='Độ khó'>
            {levels.map((item) => (
              <button
                key={item.key}
                type='button'
                role='radio'
                aria-checked={level === item.key}
                className={`jg-level${level === item.key ? ' is-active' : ''} is-${item.key}`}
                onClick={() => setLevel(item.key)}
              >
                <strong>{item.label}</strong>
                <small>{LEVEL_HINT[item.key]}</small>
              </button>
            ))}
          </div>

          <div className='jg-segment' role='radiogroup' aria-label='Phe'>
            {SIDE_OPTIONS.map((item) => (
              <button
                key={item.key}
                type='button'
                role='radio'
                aria-checked={side === item.key}
                className={side === item.key ? 'is-active' : ''}
                onClick={() => setSide(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type='button'
            className='jg-btn jg-btn--practice'
            disabled={busy}
            onClick={() => run(() => createJunglePractice({ level, side: side === 'random' ? undefined : side }), 'Đăng nhập để tập Cờ thú')}
          >
            Bắt đầu tập
          </button>

          <div className='jg-ranks'>
            {['elephant', 'lion', 'tiger', 'leopard', 'wolf', 'dog', 'cat', 'rat'].map((type) => (
              <span key={type} className={`jg-rank is-${type}`} title={PIECES[type].name}>
                <img src={iconUrl(type)} alt='' />
                <b>{PIECES[type].rank}</b>
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default JungleLobby
