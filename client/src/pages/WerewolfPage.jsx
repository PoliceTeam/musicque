import React, { useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import { Link } from 'react-router-dom'
import UserMenu from '../components/Auth/UserMenu'
import PlayerGrid from '../components/Werewolf/PlayerGrid'
import GameFeed from '../components/Werewolf/GameFeed'
import WerewolfRulesModal from '../components/Werewolf/WerewolfRulesModal'
import WerewolfHistoryModal from '../components/Werewolf/WerewolfHistoryModal'
import { useWerewolf } from '../components/Werewolf/useWerewolf'
import { useAuth } from '../contexts/AuthContext'
import {
  fillWerewolfBots,
  joinWerewolf,
  leaveWerewolf,
  resetWerewolf,
  sendWerewolfAction,
  sendWerewolfChat,
  setWerewolfReady,
  startWerewolf,
} from '../services/api'
import { PHASE_META, TEAM_LABEL, formatCountdown, getRemainingMs, roleMeta } from '../utils/werewolf'
import '../styles/werewolf.css'

const RESULT_ICON = { village: '🏡', wolf: '🐺', killer: '🔪', tanner: '👺', lovers: '💞', none: '🪦' }

const useClock = (ms = 250) => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}

const PhaseBanner = ({ state, remaining }) => {
  if (state.status === 'lobby') {
    return (
      <div className='ww-banner ww-banner--lobby'>
        <span className='ww-banner__icon'>🏚️</span>
        <div>
          <strong>Sảnh chờ · {state.players.length}/{state.config.maxPlayers} người</strong>
          <small>
            {state.autoStartAt
              ? `Tự bắt đầu sau ${formatCountdown(remaining)}`
              : `Cần tối thiểu ${state.config.minPlayers} người để bắt đầu`}
          </small>
        </div>
      </div>
    )
  }
  if (state.status === 'ended') {
    return (
      <div className={`ww-banner ww-banner--ended is-${state.result.team}`}>
        <span className='ww-banner__icon'>{RESULT_ICON[state.result.team]}</span>
        <div>
          <strong>{state.result.teamLabel} {state.result.team === 'none' ? '' : 'chiến thắng!'}</strong>
          <small>Ván kết thúc sau {state.day} ngày</small>
        </div>
      </div>
    )
  }
  const meta = PHASE_META[state.phase] || PHASE_META.night
  return (
    <div className={`ww-banner ww-banner--${state.phase}`}>
      <span className='ww-banner__icon'>{meta.icon}</span>
      <div>
        <strong>{meta.label} {state.phase === 'hunter' ? '' : state.day}</strong>
        <small>{state.players.filter((p) => p.alive).length} người còn sống</small>
      </div>
      <span className={`ww-banner__clock${remaining <= 10_000 ? ' is-urgent' : ''}`}>{formatCountdown(remaining)}</span>
    </div>
  )
}

const MyRole = ({ state, catalog }) => {
  const me = state.me
  const role = roleMeta(catalog, me?.role)
  if (!me || !role) return null
  const lover = me.loverId && state.players.find((p) => p.userId === me.loverId)
  return (
    <div className={`ww-myrole is-${role.team}${me.alive ? '' : ' is-dead'}`}>
      <span className='ww-myrole__emoji'>{role.emoji}</span>
      <div>
        <span className='ww-myrole__eyebrow'>VAI CỦA BẠN · {TEAM_LABEL[role.team]}{me.alive ? '' : ' · ĐÃ CHẾT'}</span>
        <strong>{role.name}</strong>
        <p>{role.summary}</p>
        {lover && <p className='ww-myrole__extra'>💞 Bạn đang yêu {lover.displayName}</p>}
        {me.role === 'gunner' && <p className='ww-myrole__extra'>🔫 Còn {me.bullets} viên đạn</p>}
      </div>
    </div>
  )
}

const WerewolfPage = () => {
  const { user, isAdmin, requireAuth, refreshBalance } = useAuth()
  const { state, receivedAt, catalog, run } = useWerewolf()
  const now = useClock()
  const [rulesOpen, setRulesOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const rewardedRef = useRef(null)

  const phaseKey = `${state?.status}-${state?.day}-${state?.phase}`
  useEffect(() => { setPending(null) }, [phaseKey])

  useEffect(() => {
    const reward = state?.me?.reward
    if (state?.status !== 'ended' || !reward || rewardedRef.current === state.gameId) return
    rewardedRef.current = state.gameId
    message.success(`🏆 Phe bạn thắng: +${reward} PC`)
    refreshBalance()
  }, [state?.status, state?.me?.reward, state?.gameId, refreshBalance])

  const call = async (request) => {
    setBusy(true)
    const done = await run(request)
    setBusy(false)
    return done
  }

  if (!state) {
    return (
      <div className='ww-page'>
        <div className='ww-loading'>Đang thắp đuốc vào làng…</div>
      </div>
    )
  }

  const me = state.me
  const action = me?.action
  const endsAt = state.status === 'lobby' ? state.autoStartAt : state.phaseEndsAt
  const remaining = getRemainingMs(endsAt, state, receivedAt, now)
  const isHost = user && state.hostId === String(user._id)
  const choice = state.phase === 'vote' ? (me?.vote ? [me.vote] : []) : [me?.choice?.targetId, me?.choice?.targetId2].filter(Boolean)
  const selectedIds = pending ? [pending] : choice
  const hunter = state.hunterId && state.players.find((p) => p.userId === state.hunterId)

  const join = () => requireAuth('Đăng nhập để vào làng Ma Sói.') && call(joinWerewolf)
  const submit = (payload) => call(() => sendWerewolfAction({ kind: action.kind, ...payload }))

  const pick = (targetId) => {
    if (!action?.targets?.includes(targetId) || busy) return
    if (!action.needsTwo) {
      submit({ targetId })
      return
    }
    if (!pending) setPending(targetId)
    else if (pending === targetId) setPending(null)
    else {
      submit({ targetId: pending, targetId2: targetId })
      setPending(null)
    }
  }

  const choiceNames = choice
    .map((id) => (id === 'skip' ? 'Bỏ qua' : state.players.find((p) => p.userId === id)?.displayName))
    .filter(Boolean)
    .join(' & ')

  return (
    <div className={`ww-page ww-page--${state.status === 'playing' ? state.phase : state.status}`}>
      <header className='ww-topbar'>
        <Link to='/' className='ww-back'>← Về Musicque</Link>
        <div className='ww-topbar__brand'><span>🐺</span><strong>Ma Sói</strong></div>
        <div className='ww-topbar__account'>
          <button type='button' className='sp-btn sp-btn--ghost sp-btn--sm' onClick={() => setHistoryOpen(true)}>🕰️ Lịch sử ván</button>
          <button type='button' className='sp-btn sp-btn--ghost sp-btn--sm' onClick={() => setRulesOpen(true)}>📜 Luật & vai</button>
          <UserMenu />
        </div>
      </header>

      <main className='ww-stage'>
        <div className='ww-main'>
          <PhaseBanner state={state} remaining={remaining} />
          <MyRole state={state} catalog={catalog} />

          {state.status === 'lobby' && (
            <div className='ww-actions sp-panel'>
              <p>
                {me
                  ? isHost ? 'Bạn là chủ phòng — bắt đầu khi đủ người, hoặc để đồng hồ tự chạy.' : 'Đã vào làng. Chờ chủ phòng bắt đầu nhé…'
                  : `Vào làng để nhận một vai bí mật. Cần ${state.config.minPlayers}–${state.config.maxPlayers} người.`}
              </p>
              <div className='ww-actions__buttons'>
                {!me && <button type='button' className='sp-btn sp-btn--primary' disabled={busy} onClick={join}>🚪 Vào làng</button>}
                {me && isHost && (
                  <button type='button' className='sp-btn sp-btn--primary' disabled={busy || state.players.length < state.config.minPlayers} onClick={() => call(startWerewolf)}>
                    🌕 Bắt đầu
                  </button>
                )}
                {me && <button type='button' className='sp-btn sp-btn--outline' disabled={busy} onClick={() => call(leaveWerewolf)}>Rời làng</button>}
                {isAdmin && <button type='button' className='sp-btn sp-btn--ghost' disabled={busy} onClick={() => call(fillWerewolfBots)}>🤖 Thêm bot (test)</button>}
              </div>
            </div>
          )}

          {state.status === 'playing' && (
            <div className='ww-actions sp-panel'>
              {action && action.kind !== 'none' ? (
                <>
                  <p><strong>{action.label}</strong>{choiceNames && <> · Đã chọn: <em>{choiceNames}</em></>}{pending && ' · chọn thêm một người nữa'}</p>
                  {action.allowSkip && (
                    <div className='ww-actions__buttons'>
                      <button type='button' className={`sp-btn sp-btn--outline${me.vote === 'skip' ? ' is-active' : ''}`} disabled={busy} onClick={() => submit({ targetId: 'skip' })}>
                        🤷 Bỏ qua, không treo ai
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p>
                  {action?.label
                    || (!me ? 'Bạn đang xem ván này. Ván sau nhớ vào làng sớm nhé!'
                      : !me.alive ? '🪦 Bạn đã chết. Hãy theo dõi và trò chuyện ở Nghĩa địa.'
                        : state.phase === 'night' ? '😴 Bạn đang ngủ say… chờ trời sáng.'
                          : state.phase === 'hunter' ? `🎯 Đang chờ thợ săn ${hunter?.displayName || ''} bóp cò…`
                            : 'Thảo luận xem ai là sói nào!')}
                </p>
              )}
              {state.phase === 'day' && me?.alive && (
                <div className='ww-actions__buttons'>
                  <button type='button' className={`sp-btn ${me.ready ? 'sp-btn--primary' : 'sp-btn--outline'}`} disabled={busy} onClick={() => call(() => setWerewolfReady(!me.ready))}>
                    {me.ready ? '✓ Đã sẵn sàng bỏ phiếu' : 'Sẵn sàng bỏ phiếu'}
                  </button>
                  <span className='ww-actions__meta'>{state.players.filter((p) => p.ready).length}/{state.players.filter((p) => p.alive).length} sẵn sàng</span>
                </div>
              )}
              {isAdmin && (
                <button type='button' className='ww-actions__reset' onClick={() => window.confirm('Huỷ ván đang chơi và mở sảnh mới?') && call(resetWerewolf)}>
                  Huỷ ván (admin)
                </button>
              )}
            </div>
          )}

          {state.status === 'ended' && (
            <div className='ww-actions sp-panel'>
              <p>
                {me
                  ? state.result.winners.includes(me.userId) ? `🏆 Bạn thuộc phe thắng!${me.reward ? ` +${me.reward} PC` : state.hasBots ? ' (ván có bot nên không tính thưởng)' : ''}` : 'Lần này phe bạn thua rồi. Làm ván nữa chứ?'
                  : 'Ván đã kết thúc. Vai của mọi người đã được lật.'}
              </p>
              <div className='ww-actions__buttons'>
                <button type='button' className='sp-btn sp-btn--primary' disabled={busy} onClick={join}>🔁 Ván mới</button>
                <button type='button' className='sp-btn sp-btn--outline' onClick={() => setHistoryOpen(true)}>🕰️ Xem lại 5 ván gần nhất</button>
              </div>
            </div>
          )}

          <PlayerGrid state={state} catalog={catalog} selectedIds={selectedIds} onPick={pick} />
        </div>

        <GameFeed state={state} onSend={(content) => run(() => sendWerewolfChat(content))} />
      </main>

      <WerewolfHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} catalog={catalog} myId={user ? String(user._id) : null} />
      <WerewolfRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} catalog={catalog} config={state.config} />
    </div>
  )
}

export default WerewolfPage
