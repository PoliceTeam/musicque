import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRedLight } from '../../contexts/RedLightContext'
import { useAuth } from '../../contexts/AuthContext'
import RedLightField from './RedLightField'
import RedLightRulesModal from './RedLightRulesModal'
import {
  createMockRedLightPreview,
  findMe,
  getLobbyOccupancy,
  getPhaseAt,
  getPhaseLabel,
  getRemainingMs,
  getSyncedNow,
  STATUS,
} from '../../utils/redLight'

const noop = () => {}

const RedLightOverlay = ({ open, onClose, preview = false }) => {
  const live = useRedLight()
  const { user, isAuthenticated, isAdmin, openAuthModal } = useAuth()
  const [rulesOpen, setRulesOpen] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [holding, setLocalHolding] = useState(false)
  const [mockHold, setMockHold] = useState(false)

  const mockState = useMemo(
    () => (preview ? createMockRedLightPreview({ now: Date.now() }) : null),
    [preview],
  )

  const state = preview ? mockState : live.state
  const config = preview ? (mockState?.config || live.config) : live.config
  const receivedAt = preview ? now : live.receivedAt
  const joined = preview ? true : live.joined
  const join = preview ? noop : live.join
  const fillBots = preview ? noop : live.fillBots
  const leave = preview ? noop : live.leave
  const setHolding = preview ? noop : live.setHolding

  useEffect(() => {
    if (!open) return undefined
    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(interval)
  }, [open])

  useEffect(() => {
    if (!open) {
      setHolding(false)
      setLocalHolding(false)
      setMockHold(false)
    }
  }, [open, setHolding])

  const syncedNow = getSyncedNow(state?.serverNow, receivedAt, now)
  const status = state?.status || STATUS.CLOSED
  const playing = status === STATUS.PLAYING
  const phase = playing
    ? getPhaseAt(state?.round?.schedule, syncedNow) || state?.round?.currentPhase
    : state?.round?.currentPhase
  const me = preview
    ? (state?.round?.players || []).find((player) => player.userId === 'mock-you')
    : findMe(state, user?._id)
  const alive = me?.status === 'alive'
  const canRun = open && joined && playing && alive

  const releaseHold = () => {
    setLocalHolding(false)
    setMockHold(false)
    setHolding(false)
  }

  const startHold = () => {
    if (!canRun) return
    setLocalHolding(true)
    if (preview) setMockHold(true)
    setHolding(true)
  }

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!preview && joined) leave(playing ? 'overlay_closed' : 'leave')
        setLocalHolding(false)
        setMockHold(false)
        setHolding(false)
        onClose()
        return
      }
      if (event.code !== 'Space' && event.key !== ' ') return
      event.preventDefault()
      if (!canRun) return
      setLocalHolding(true)
      if (preview) setMockHold(true)
      setHolding(true)
    }
    const onKeyUp = (event) => {
      if (event.code !== 'Space' && event.key !== ' ') return
      setLocalHolding(false)
      setMockHold(false)
      setHolding(false)
    }
    const onBlur = () => {
      setLocalHolding(false)
      setMockHold(false)
      setHolding(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onBlur)
    }
  }, [open, onClose, canRun, joined, leave, playing, setHolding, preview])

  const handleClose = async () => {
    if (!preview && joined) await leave(playing ? 'overlay_closed' : 'leave')
    releaseHold()
    onClose()
  }

  const players = (state?.round?.players || []).map((player) => (
    preview && player.userId === 'mock-you'
      ? { ...player, holding: mockHold }
      : player
  ))
  const countdown = status === STATUS.COUNTDOWN
    ? getRemainingMs(state?.round?.countdownEndsAt, syncedNow)
    : 0
  const roundLeft = playing ? getRemainingMs(state?.round?.roundEndsAt, syncedNow) : 0
  const occupancy = useMemo(
    () => getLobbyOccupancy({
      lobbyCount: state?.lobbyCount,
      minPlayers: config.minPlayers,
      maxPlayers: config.maxPlayers,
    }),
    [state?.lobbyCount, config.minPlayers, config.maxPlayers],
  )
  const statusLine = status === STATUS.COUNTDOWN
    ? `Sắp bắt đầu · ${occupancy.countLabel}`
    : occupancy.statusLabel

  if (!open) return null

  const showLogin = () => {
    onClose()
    openAuthModal('login', 'Đăng nhập để chơi Đèn xanh Đèn đỏ.')
  }

  return createPortal(
    <div
      className="rl-backdrop"
      onClick={playing ? undefined : handleClose}
    >
      <section
        className="rl-game"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rl-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="rl-game__head">
          <div>
            <span>{preview ? 'MOCK UI · DEV ONLY' : 'CHẠY KHI XANH · ĐỨNG KHI ĐỎ'}</span>
            <h2 id="rl-title">Đèn xanh, Đèn đỏ</h2>
          </div>
          <div className="rl-game__head-actions">
            <button type="button" onClick={() => setRulesOpen(true)} aria-label="Xem luật">?</button>
            <button type="button" onClick={handleClose} aria-label="Đóng">✕</button>
          </div>
        </header>

        <RedLightRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

        {!state?.active ? (
          <div className="rl-empty">
            <span>🌙</span>
            <strong>Game đang đóng</strong>
            <p>Đèn xanh Đèn đỏ chỉ mở khi có phiên phát nhạc.</p>
          </div>
        ) : (
          <div className="rl-layout">
            <main className="rl-arena">
              <div className="rl-status">
                <span>
                  {status === STATUS.PLAYING || status === STATUS.SETTLED
                    ? `${preview ? 'Preview' : `Ván #${state.round?.roundNumber || '—'}`} · ${getPhaseLabel(phase, status)}`
                    : statusLine}
                </span>
                {countdown > 0 && <strong>{countdown}s</strong>}
                {playing && <strong className={phase?.type === 'red' ? 'is-urgent' : ''}>{roundLeft}s</strong>}
              </div>

              <RedLightField
                players={players.length ? players : (state.lobby || []).map((player, index) => ({
                  ...player,
                  progress: 0,
                  status: 'alive',
                  holding: false,
                  lane: index,
                }))}
                phase={phase}
                holding={holding}
                onHoldStart={startHold}
                onHoldEnd={releaseHold}
              />

              {status === STATUS.SETTLED && (
                <div className="rl-result">
                  {state.round?.winner ? (
                    <>
                      <span>🏁</span>
                      <h3>{state.round.winner.displayName} về đích!</h3>
                      <ol>
                        {(state.round.placements || []).slice(0, 3).map((placement) => (
                          <li key={placement.userId}>
                            #{placement.rank} {placement.displayName}
                            {placement.payout > 0 ? ` · +${placement.payout} PC` : ''}
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : (
                    <>
                      <span>😶</span>
                      <h3>Cả phòng bị loại</h3>
                      <p>Không có thưởng ván này. Ván sau bắt đầu nếu còn đủ người.</p>
                    </>
                  )}
                </div>
              )}
            </main>

            <aside className="rl-side">
              <h3>Người chơi</h3>
              <ul>
                {(state.lobby || []).map((player) => (
                  <li key={player.userId}>
                    <span>{player.displayName}</span>
                    {preview && player.userId === 'mock-you' ? <em>bạn</em> : null}
                    {!preview && String(player.userId) === String(user?._id) ? <em>bạn</em> : null}
                    {player.isBot ? <em>bot</em> : null}
                  </li>
                ))}
              </ul>
              {preview ? (
                <p className="rl-side__note">
                  Preview mock — không cần đăng nhập / session / bot.
                  Shift+click 🚦 hoặc mở <code>?rlMock=1</code>.
                </p>
              ) : !isAuthenticated ? (
                <button type="button" className="sp-btn sp-btn--primary" onClick={showLogin}>
                  Đăng nhập để tham gia
                </button>
              ) : joined ? (
                <button
                  type="button"
                  className="sp-btn"
                  onClick={() => leave(playing ? 'overlay_closed' : 'leave')}
                  disabled={status === STATUS.COUNTDOWN}
                >
                  {playing ? 'Bỏ cuộc' : 'Rời phòng chờ'}
                </button>
              ) : (
                <button
                  type="button"
                  className="sp-btn sp-btn--primary"
                  onClick={join}
                  disabled={status === STATUS.COUNTDOWN}
                >
                  Tham gia · {occupancy.countLabel}
                </button>
              )}
              {!preview && isAdmin && status === STATUS.LOBBY && (
                <button
                  type="button"
                  className="sp-btn sp-btn--primary"
                  style={{ marginTop: 8 }}
                  onClick={fillBots}
                >
                  Thêm bot để thử
                </button>
              )}
              {!preview && (
                <p className="rl-side__note">
                  Cần {config.minPlayers} người để bắt đầu, tối đa {config.maxPlayers}. Miễn phí, thưởng {config.payouts?.join('/')} PC.
                </p>
              )}
            </aside>
          </div>
        )}
      </section>
    </div>,
    document.body,
  )
}

export default RedLightOverlay
