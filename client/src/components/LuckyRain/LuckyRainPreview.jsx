import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import RewardScene from './RewardScene'
import { rewardDuration } from './luckyRainPresentation'
import { LuckyRainRibbon } from './LuckyRain'
import './lucky-rain.css'

const SAMPLES = [
  { tier: 'small', amount: 12, label: 'Lộc nhỏ', range: '5–15 PC', odds: '60%' },
  { tier: 'bright', amount: 22, label: 'Lộc vui', range: '16–25 PC', odds: '25%' },
  { tier: 'grand', amount: 32, label: 'Đại lộc', range: '26–35 PC', odds: '14%' },
  { tier: 'legendary', amount: 50, label: 'Lộc vàng', range: '50 PC', odds: '1%' },
]

// Chỉ được đăng ký trong dev; dùng đúng scene thật, không gọi nhận thưởng.
export default function LuckyRainPreview() {
  const [sample, setSample] = useState(SAMPLES[0])
  const [phase, setPhase] = useState('ready')
  const [take, setTake] = useState(0)
  const [dark, setDark] = useState(false)
  useEffect(() => {
    if (phase !== 'revealing') return undefined
    const timer = setTimeout(() => setPhase('result'), rewardDuration(sample.tier))
    return () => clearTimeout(timer)
  }, [phase, sample])
  return <main className={`lr-preview${dark ? ' lr-preview--dark' : ''}`}>
    <div className='lr-preview__intro'>
      <Link to='/'>← Về Musicque</Link>
      <span className='lr-preview__eyebrow'>MƯA LÌ XÌ · XEM THỬ CHUYỂN ĐỘNG</span>
      <h1>Một chút lộc.<br /><em>Một phiên nhạc vui.</em></h1>
      <p>Chọn một nhóm thưởng rồi mở bao. Mỗi độ hiếm có một khoảnh khắc riêng.</p>
      <div className='lr-preview__tiers'>
        {SAMPLES.map((item) => <button type='button' className={`lr-preview__tier lr-preview__tier--${item.tier}${sample.tier === item.tier ? ' is-selected' : ''}`} key={item.tier} onClick={() => { setSample(item); setPhase('ready'); setTake((value) => value + 1) }}>
          <span>{item.label} <small>{item.odds}</small></span><strong>{item.range}</strong>
        </button>)}
      </div>
      <div className='lr-preview__actions'>
        <button type='button' className='sp-btn' onClick={() => { setPhase('waiting'); setTake((value) => value + 1) }}>Xem giao diện chờ</button>
        <button type='button' className='sp-btn' onClick={() => { setPhase('ready'); setTake((value) => value + 1) }}>Mở lại bao ↗</button>
        <button type='button' className='sp-btn' onClick={() => setDark((value) => !value)}>{dark ? 'Nền sáng' : 'Nền tối'}</button>
      </div>
      <p className='lr-preview__note'>Bản xem thử · Không cộng hoặc trừ PCs</p>
      <LuckyRainRibbon active available={phase !== 'waiting'} seconds={phase === 'waiting' ? '08:32' : '00:48'} onClick={() => { setPhase('ready'); setTake((value) => value + 1) }} />
    </div>
    <div className='lr-preview__scene' key={take}>
      <RewardScene phase={phase} reward={sample} seconds='08:32' available onOpen={() => setPhase('revealing')} onClose={() => setPhase('result')} />
    </div>
  </main>
}
