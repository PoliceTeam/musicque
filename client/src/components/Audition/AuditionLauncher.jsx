import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAuditionRooms } from '../../services/api'
import AtlasImg from './AtlasImg'
import { FRAME } from './auditionConfig'
import './audition-launcher.css'

const POLL_MS = 20_000
const KEYS = ['left', 'up', 'down', 'right']

const statusOf = (rooms) => {
  if (!rooms) return { tone: 'idle', text: 'Mở phòng, rủ cả team nhảy' }
  const waiting = rooms.filter((r) => r.status !== 'playing').length
  const playing = rooms.length - waiting
  if (waiting) return { tone: 'waiting', text: `${waiting} phòng đang chờ người` }
  if (playing) return { tone: 'live', text: `${playing} phòng đang nhảy` }
  return { tone: 'idle', text: 'Mở phòng, rủ cả team nhảy' }
}

// Thẻ gọi vào Neon Dance ở sidebar Home: nền neon, 4 phím tròn nhún theo nhịp.
const AuditionLauncher = () => {
  const navigate = useNavigate()
  const [rooms, setRooms] = useState(null)

  useEffect(() => {
    let alive = true
    const load = () => getAuditionRooms().then(({ data }) => alive && setRooms(data)).catch(() => {})
    load()
    const id = window.setInterval(load, POLL_MS)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  const status = statusOf(rooms)
  return (
    <button type='button' className={`au-launch is-${status.tone}`} onClick={() => navigate('/audition')} aria-label='Vào chơi Neon Dance'>
      <span className='au-launch__keys' aria-hidden='true'>
        {KEYS.map((dir, i) => (
          <span key={dir} style={{ '--i': i }}>
            <AtlasImg name={FRAME.arrow(dir, i === 3 ? 'hit' : 'normal')} height={30} />
          </span>
        ))}
      </span>
      <span className='au-launch__copy'>
        <span className='au-launch__eyebrow'>MỚI · NHẢY THEO NHỊP · TỚI 6 NGƯỜI</span>
        <strong className='au-launch__title'>NEON DANCE</strong>
        <span className='au-launch__status'><i />{status.text}</span>
      </span>
    </button>
  )
}

export default AuditionLauncher
