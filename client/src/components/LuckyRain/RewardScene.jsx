import React, { useMemo } from 'react'
import Envelope from './Envelope'
import { REWARD_PRESENTATION as TIERS } from './luckyRainPresentation'
import { createParticles } from './luckyRainParticles'

export default function RewardScene({ phase, reward, seconds = '00:00', active = true, available, error, onOpen, onClose, onRetry }) {
  const tier = reward?.tier || 'small'
  const result = phase === 'result'
  const revealing = phase === 'revealing'
  // Mỗi lần mở có bố cục mới, nhưng countdown re-render không đổi quỹ đạo.
  const particles = useMemo(() => createParticles(revealing ? tier : 'small'), [tier, revealing])
  const ready = phase === 'ready'
  const waiting = phase === 'waiting'
  const celebrating = result || revealing
  return <section className={`lr-scene lr-scene--${celebrating ? tier : 'waiting'} lr-scene--${phase}`} aria-label='Bao lì xì của bạn'>
    <div className='lr-scene__grain' aria-hidden='true' />
    <div className='lr-scene__stars' aria-hidden='true'>
      {Array.from({ length: 24 }, (_, i) => <i key={i} style={{ '--x': `${(i * 37 + 11) % 100}%`, '--y': `${(i * 23 + 7) % 94}%`, '--delay': `${i % 7 * -.6}s` }} />)}
    </div>
    <header className='lr-scene__header'>
      <span className='lr-scene__eyebrow'><span /> MUSICQUE · MƯA LÌ XÌ <span /></span>
      <h2>{result ? TIERS[tier].title : waiting ? 'Niềm vui đang đến' : 'Một bao lộc dành cho bạn'}</h2>
      <p>{result ? 'Một chút may mắn cho phiên nhạc thêm vui.' : waiting ? 'Ở lại nghe nhạc. Lộc sẽ đến đúng giờ.' : 'Chạm mở bao, đón một chút may mắn.'}</p>
    </header>
    <div className='lr-stage' aria-hidden='true'>
      <div className='lr-stage__aura' />
      <div className='lr-stage__rays' />
      <div className='lr-stage__ring lr-stage__ring--outer' />
      <div className='lr-stage__ring lr-stage__ring--inner' />
      <div className='lr-stage__orbit'>
        {particles.motes.map((style, i) => <i key={i} style={style}>✦</i>)}
      </div>
      <div className='lr-stage__envelope'><Envelope /></div>
      <div className='lr-stage__beam' />
      <div className='lr-stage__coins'>
        {particles.coins.map((style, i) => <i key={i} style={style}>P</i>)}
      </div>
      <div className='lr-stage__fireworks'>
        {particles.sparks.map((style, i) => <i key={i} style={style} />)}
      </div>
      {result && <div className='lr-reward'>
        <span className='lr-reward__badge'>{tier === 'legendary' ? '✦ ' : ''}{TIERS[tier].label}{tier === 'legendary' ? ' · 1% may mắn' : ''}</span>
        <div className='lr-reward__amount'><span>+</span>{reward.amount}<small>PC</small></div>
        <span className='lr-reward__caption'>Polite Coins</span>
      </div>}
    </div>
    <footer className='lr-scene__footer'>
      {waiting && <><span className='lr-scene__count-label'>{active ? 'LÌ XÌ TIẾP THEO SAU' : 'LỘC TRỞ LẠI KHI PHIÊN NHẠC BẮT ĐẦU'}</span><strong className='lr-scene__count'>{active ? seconds : '♫'}</strong></>}
      {ready && <button type='button' className='sp-btn lr-open-button' onClick={onOpen} disabled={!available}>Mở bao lì xì <span>↗</span></button>}
      {phase === 'pending' && <p role='status' className='lr-scene__status'>Đang xác nhận bao lộc của bạn…</p>}
      {revealing && <><p className='lr-scene__status'>May mắn đang hé mở…</p><button type='button' className='lr-scene__skip' onClick={onClose}>Bỏ qua hiệu ứng</button></>}
      {result && <><p role='status' className='lr-scene__credited'>✓ Bạn nhận được {reward.amount} PC · Đã cộng vào ví</p><button type='button' className='sp-btn lr-open-button' onClick={onClose}>Tiếp tục nghe nhạc <span>♫</span></button></>}
      {error && <div role='alert' className='lr-scene__error'><p>{error}</p><button type='button' className='sp-btn lr-open-button' onClick={onRetry}>Kiểm tra lại</button></div>}
      {(ready || waiting) && !error && <p className='lr-scene__hint'>{ready ? 'Mỗi đợt một bao · Ai cũng có lộc' : 'Mỗi 15 phút · 5–50 PC · Mỗi người một bao'}</p>}
      {ready && !available && <p role='status'>Đợt này đã kết thúc. Hẹn bạn đợt tiếp theo!</p>}
    </footer>
  </section>
}
