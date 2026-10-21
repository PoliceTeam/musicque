import React, { useEffect, useRef, useState } from 'react'
import { Modal } from 'antd'
import { ArrowRightOutlined, PlayCircleFilled, PauseCircleFilled, SoundOutlined, AudioMutedOutlined } from '@ant-design/icons'
import './ice-city-intro.css'

export default function IceCityIntroModal({ open, onClose, onPlay, playHref }) {
  const video = useRef(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const [muted, setMuted] = useState(true)
  useEffect(() => {
    const media = video.current
    let active = true
    // Mặc định tự phát tắt tiếng; người xem chủ động bật âm thanh.
    if (media && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      media.muted = true
      media.play()?.catch(() => { if (active) setPlaying(false) })
    }
    return () => { active = false; media?.pause() }
  }, [])

  const togglePlayback = () => {
    const media = video.current
    if (!media) return
    if (playing) { media.pause(); return }
    if (ended || media.ended) media.currentTime = 0
    setEnded(false)
    media.play()?.catch(() => setPlaying(false))
  }
  const toggleSound = () => {
    const media = video.current
    if (!media) return
    media.muted = !media.muted
    setMuted(media.muted)
  }
  const close = () => { video.current?.pause(); onClose() }
  const play = () => { video.current?.pause(); onPlay() }
  if (!open) return null

  return (
    <Modal open centered width={1000} footer={null} onCancel={close} destroyOnHidden
      className='ice-intro-modal' title={null} aria-labelledby='ice-intro-title'>
      <section className='ice-intro'>
        <div className='ice-intro__screen'>
          <video ref={video} className='ice-intro__video' playsInline muted
            autoPlay={!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches}
            onPlaying={() => { setPlaying(true); setEnded(false) }}
            onPause={() => setPlaying(false)}
            onEnded={() => { setPlaying(false); setEnded(true) }}
            onVolumeChange={() => setMuted(video.current?.muted ?? false)}
            preload='metadata' poster='/intro/ice-city/poster-v2.webp'
            aria-label='Trailer giới thiệu ICE City' onError={() => setVideoFailed(true)}>
            <source src='/intro/ice-city/trailer-v2.mp4' type='video/mp4' />
          </video>
          {ended && <img className='ice-intro__replay-poster' src='/intro/ice-city/poster-v2.webp' alt='' />}
          {!videoFailed && <>
            <button type='button' className={`ice-intro__video-toggle${playing ? ' is-playing' : ''}`}
              onClick={togglePlayback} aria-label={playing ? 'Tạm dừng trailer' : ended ? 'Xem lại trailer' : 'Phát trailer'}>
              <span className='ice-intro__video-toggle-content'>
                {playing ? <PauseCircleFilled aria-hidden='true' /> : <PlayCircleFilled aria-hidden='true' />}
              </span>
            </button>
            <button type='button' className='ice-intro__sound' onClick={toggleSound}
              aria-label={muted ? 'Bật tiếng trailer' : 'Tắt tiếng trailer'}>
              {muted ? <AudioMutedOutlined aria-hidden='true' /> : <SoundOutlined aria-hidden='true' />}
            </button>
          </>}
        </div>
        <div className='ice-intro__body'>
          <div className='ice-intro__copy'>
            <p className='ice-intro__eyebrow'><span /> GAME MỚI TRONG MUSICQUE</p>
            <h2 id='ice-intro-title'>Bật nhạc lên. Vào phố chơi thôi!</h2>
            <p className='ice-intro__description'>Trồng trọt, sắm đồ, chơi game và hẹn cả hội ở ICE City.<br />Một thế giới chibi đang chờ bạn khám phá.</p>
            {videoFailed && <p className='ice-intro__video-error' role='status'>Chưa tải được trailer. Bạn vẫn có thể vào chơi ngay.</p>}
          </div>
          <div className='ice-intro__actions'>
            {playHref
              ? <a className='ice-intro__play' href={playHref} target='_blank' rel='noopener noreferrer' onClick={close}>Chơi ngay <ArrowRightOutlined aria-hidden="true" /></a>
              : <button type='button' className='ice-intro__play' onClick={play}>Chơi ngay <ArrowRightOutlined aria-hidden="true" /></button>}
            <button type='button' className='ice-intro__later' onClick={close}>Để sau, nghe nhạc tiếp</button>
          </div>
        </div>
      </section>
    </Modal>
  )
}
