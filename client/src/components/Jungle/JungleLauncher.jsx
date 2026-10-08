import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getJungleLobby } from '../../services/api'
import './jungle-launcher.css'

const POLL_MS = 20_000
const PETS = ['animal-elephant.png', 'animal-lion.png', 'animal-koala.png']

const statusOf = (lobby) => {
  if (!lobby) return { tone: 'idle', text: 'Tập với máy hoặc mở bàn đấu' }
  if (lobby.waiting.length) return { tone: 'waiting', text: `${lobby.waiting.length} bàn đang chờ đối thủ` }
  if (lobby.playing.length) return { tone: 'live', text: `${lobby.playing.length} ván đang diễn ra` }
  return { tone: 'idle', text: 'Tập với máy hoặc mở bàn đấu' }
}

// Thẻ gọi vào Cờ thú ở sidebar Home: bãi cỏ, dòng sông, ba con thú nhún nhảy.
const JungleLauncher = () => {
  const navigate = useNavigate()
  const [lobby, setLobby] = useState(null)

  useEffect(() => {
    let alive = true
    const load = () => getJungleLobby().then(({ data }) => alive && setLobby(data)).catch(() => {})
    load()
    const id = window.setInterval(load, POLL_MS)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  const status = statusOf(lobby)
  return (
    <button type='button' className={`jg-launch is-${status.tone}`} onClick={() => navigate('/jungle')} aria-label='Vào chơi Cờ thú'>
      <span className='jg-launch__river' aria-hidden='true' />
      <span className='jg-launch__pets' aria-hidden='true'>
        {PETS.map((file, i) => <img key={file} src={`/models/jungle/pets/${file}`} alt='' style={{ '--i': i }} />)}
      </span>
      <span className='jg-launch__copy'>
        <span className='jg-launch__eyebrow'>MỚI · 3D · ĐẤU 1-1</span>
        <strong className='jg-launch__title'>CỜ THÚ</strong>
        <span className='jg-launch__status'><i />{status.text}</span>
      </span>
    </button>
  )
}

export default JungleLauncher
