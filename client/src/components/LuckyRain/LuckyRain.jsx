import React, { useContext, useEffect, useRef, useState } from 'react'
import { Modal } from 'antd'
import { useLocation } from 'react-router-dom'
import { LuckyRainContext } from '../../contexts/luckyRainState'
import { useAuth } from '../../contexts/AuthContext'
import Envelope from './Envelope'
import RewardScene from './RewardScene'
import { rewardDuration, formatCountdown } from './luckyRainPresentation'
import './lucky-rain.css'

export function LuckyRainRibbon({ active, available, claimed, seconds, error, onClick }) {
  return <button type='button' className={`lr-ribbon${available && !claimed ? ' lr-ribbon--live' : ''}`} onClick={onClick} aria-label={error ? 'Kiểm tra lại lịch lì xì' : available && !claimed ? `Nhận lì xì, đợt còn ${seconds}` : `Lì xì tiếp theo sau ${seconds}`}>
    <span className='lr-ribbon__icon'><Envelope mini /></span>
    <span className='lr-ribbon__copy'><span className='lr-ribbon__eyebrow'>{available && !claimed ? '✦ MƯA LÌ XÌ ĐANG DIỄN RA' : 'MƯA LÌ XÌ'}</span>
      <strong>{error ? 'Kiểm tra lại lịch lì xì' : !active ? 'Lộc trở lại khi phiên nhạc bắt đầu' : available && !claimed ? 'Một bao lộc đang chờ bạn' : claimed ? 'Đã nhận lộc · Đợt tiếp theo' : 'Lì xì tiếp theo sau'}</strong>
    </span>
    {active && <span className='lr-ribbon__time'>{seconds}<small>{available && !claimed ? 'CÒN LẠI' : 'ĐẾM NGƯỢC'}</small></span>}
    <span className='lr-ribbon__arrow'>{available && !claimed ? 'Nhận lộc ↗' : '↗'}</span>
  </button>
}

export default function LuckyRain() {
  const { pathname } = useLocation()
  const { state, now, available, error: stateError, refresh, claim } = useContext(LuckyRainContext)
  const { user, requireAuth } = useAuth()
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState('waiting')
  const [reward, setReward] = useState(null)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const attempt = useRef(0)
  const attemptedRound = useRef(null)
  const claimed = Boolean(state?.claim?.settled)
  const target = available && !claimed ? state.round.closesAt : state?.nextOpensAt
  const seconds = formatCountdown((target || now) - now)

  useEffect(() => {
    // Kết quả riêng phải biến mất khi đổi tài khoản/đăng xuất giữa thao tác.
    ++attempt.current
    pending.current = false
    attemptedRound.current = null
    setOpen(false)
    setReward(null)
    setError('')
  }, [user?._id])

  useEffect(() => {
    if (phase !== 'revealing' || !reward) return undefined
    const timer = setTimeout(() => setPhase('result'), rewardDuration(reward.tier))
    return () => clearTimeout(timer)
  }, [phase, reward])

  useEffect(() => {
    if (!open || !['waiting', 'ready'].includes(phase)) return
    if (state?.claim?.settled) {
      setReward(state.claim)
      setPhase('result')
    } else setPhase(available ? 'ready' : 'waiting')
  }, [open, phase, available, state?.claim])

  const show = () => {
    setError('')
    if (claimed) { setReward(state.claim); setPhase('result') }
    else if (!pending.current) { setReward(null); setPhase(available ? 'ready' : 'waiting') }
    setOpen(true)
    if (stateError) refresh()
  }

  const receive = async (roundId = state?.round?.id) => {
    if (pending.current || !roundId) return
    if (!requireAuth('Đăng nhập để nhận bao lì xì của bạn')) { setOpen(false); return }
    const number = ++attempt.current
    attemptedRound.current = roundId
    pending.current = true
    setError('')
    setPhase('pending')
    try {
      const result = await claim(roundId)
      if (number !== attempt.current || !result) return
      setReward(result)
      setPhase('revealing')
    } catch (requestError) {
      if (number !== attempt.current) return
      setError(requestError.response?.data?.message || 'Chưa xác nhận được kết quả. Hãy kiểm tra lại.')
      setPhase('error')
    } finally {
      if (number === attempt.current) pending.current = false
    }
  }

  const retry = async () => {
    // POST cùng roundId khôi phục claim đã nhận cả khi đợt/phiên vừa hết.
    if (attemptedRound.current) return receive(attemptedRound.current)
    await refresh()
  }

  if (pathname === '/dev/lucky-rain' || state?.config?.enabled === false || (!state && !stateError)) return null
  return <>
    <div className='lr-dock'>
      <LuckyRainRibbon active={state?.active} available={available} claimed={claimed} seconds={seconds} error={stateError} onClick={show} />
    </div>
    {available && !claimed && <div key={state.round.id} className='lr-rain' aria-hidden='true'>
      {Array.from({ length: 9 }, (_, i) => <span key={i} style={{ '--x': `${6 + i * 11}%`, '--delay': `${i * .21}s`, '--tilt': `${(i % 3 - 1) * 20}deg` }}><Envelope mini /></span>)}
    </div>}
    <Modal open={open} onCancel={() => setOpen(false)} footer={null} centered width={560} className='lr-modal' title={null}>
      <RewardScene phase={phase} reward={reward} seconds={seconds} available={available}
        active={state?.active} error={error || stateError} onOpen={() => receive()} onClose={() => setOpen(false)} onRetry={retry} />
    </Modal>
  </>
}
