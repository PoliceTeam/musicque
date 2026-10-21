import React from 'react'
import { ArrowRightOutlined } from '@ant-design/icons'
import './ice-city-promo.css'

export default function IceCityPromo({ onPlay, playHref }) {
  const content = <>
    <img className='ice-city-promo__art' src='/intro/ice-city/banner.webp' alt='' />
    <span className='ice-city-promo__new'>MỚI</span>
    <span className='ice-city-promo__footer'>
      <span>Cả hội vào phố!</span>
      <span className='ice-city-promo__cta'>Chơi ngay <ArrowRightOutlined aria-hidden='true' /></span>
    </span>
  </>
  return playHref
    ? <a className='ice-city-promo' href={playHref} target='_blank' rel='noopener noreferrer' aria-label='Vào chơi ICE City'>{content}</a>
    : <button type='button' className='ice-city-promo' onClick={onPlay} aria-label='Vào chơi ICE City'>{content}</button>
}
