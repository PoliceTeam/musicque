import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getWerewolfSummary } from '../../services/api'
import './werewolf-launcher.css'

const POLL_MS = 15_000

const PHASE_TEXT = { night: 'Đêm', day: 'Ngày', vote: 'Bỏ phiếu · ngày', hunter: 'Thợ săn · ngày' }

const statusOf = (summary) => {
  if (!summary) return { tone: 'idle', text: 'Rủ cả team vào làng' }
  if (summary.status === 'playing') {
    return { tone: 'live', text: `Đang chơi · ${PHASE_TEXT[summary.phase] || 'Đêm'} ${summary.day}` }
  }
  if (summary.status === 'lobby' && summary.players > 0) {
    const missing = Math.max(0, summary.minPlayers - summary.players)
    return { tone: 'waiting', text: missing ? `${summary.players} người chờ · thiếu ${missing}` : `${summary.players} người chờ · sắp chơi!` }
  }
  return { tone: 'idle', text: 'Làng trống · mở sảnh ngay' }
}

// Thẻ gọi vào Ma Sói ở sidebar Home: trời đêm, trăng tròn, bóng sói + trạng thái trực tiếp.
const WerewolfLauncher = () => {
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    let alive = true
    const load = () => getWerewolfSummary().then(({ data }) => alive && setSummary(data)).catch(() => {})
    load()
    const id = window.setInterval(load, POLL_MS)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  const status = statusOf(summary)

  return (
    <button type='button' className={`ww-launch is-${status.tone}`} onClick={() => navigate('/werewolf')} aria-label='Vào chơi Ma Sói'>
      <span className='ww-launch__stars' aria-hidden='true' />
      <span className='ww-launch__moon' aria-hidden='true' />
      <span className='ww-launch__wolf' aria-hidden='true'>🐺</span>
      <span className='ww-launch__fog' aria-hidden='true' />
      <span className='ww-launch__copy'>
        <span className='ww-launch__eyebrow'>MỚI · NHIỀU NGƯỜI CHƠI</span>
        <strong className='ww-launch__title'>MA SÓI</strong>
        <span className='ww-launch__tagline'>Đêm nay ai là sói?</span>
        <span className='ww-launch__status'><i />{status.text}</span>
      </span>
      <span className='ww-launch__cta' aria-hidden='true'>Vào làng →</span>
    </button>
  )
}

export default WerewolfLauncher
