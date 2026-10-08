import React, { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import UserMenu from '../components/Auth/UserMenu'
import JungleLobby from '../components/Jungle/JungleLobby'
import JungleGameView from '../components/Jungle/JungleGameView'
import JungleRulesModal from '../components/Jungle/JungleRulesModal'
import { useJungleConfig } from '../components/Jungle/useJungle'
import { setMusicEnabled, setSfxEnabled, useJungleAudioSession, useJungleAudioSettings } from '../components/Jungle/jungleAudio'
import '../styles/jungle.css'

const JunglePage = () => {
  const { gameId } = useParams()
  const config = useJungleConfig()
  const [rulesOpen, setRulesOpen] = useState(false)
  const audio = useJungleAudioSettings()
  useJungleAudioSession()

  return (
    <div className={`jg-page${gameId ? ' is-game' : ''}`}>
      <header className='jg-top'>
        <Link to={gameId ? '/jungle' : '/'} className='jg-top__back'>← {gameId ? 'Sảnh Cờ thú' : 'Trang chủ'}</Link>
        <span className='jg-top__title'>🐾 Cờ Thú</span>
        <div className='jg-top__right'>
          <div className='jg-audio' role='group' aria-label='Âm thanh'>
            <button
              type='button'
              className={`jg-audio__btn${audio.music ? ' is-on' : ''}`}
              aria-pressed={audio.music}
              title={audio.music ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
              onClick={() => setMusicEnabled(!audio.music)}
            >
              {audio.music ? '🎵' : '🔇'}<span>Nhạc</span>
            </button>
            <button
              type='button'
              className={`jg-audio__btn${audio.sfx ? ' is-on' : ''}`}
              aria-pressed={audio.sfx}
              title={audio.sfx ? 'Tắt hiệu ứng âm thanh' : 'Bật hiệu ứng âm thanh'}
              onClick={() => setSfxEnabled(!audio.sfx)}
            >
              {audio.sfx ? '🔊' : '🔈'}<span>Hiệu ứng</span>
            </button>
          </div>
          <button type='button' className='jg-btn jg-btn--ghost jg-btn--small' onClick={() => setRulesOpen(true)}>Luật chơi</button>
          <UserMenu />
        </div>
      </header>
      {gameId ? <JungleGameView key={gameId} gameId={gameId} /> : <JungleLobby config={config} />}
      <JungleRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} config={config} />
    </div>
  )
}

export default JunglePage
