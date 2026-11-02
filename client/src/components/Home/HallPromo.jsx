import React from 'react'
import { Link } from 'react-router-dom'
import './hall-promo.css'

export default function HallPromo() {
  return (
    <Link to='/hall' className='hall-promo' aria-label='Vào sảnh thiền'>
      <img className='hall-promo__art' src='/models/hall/home-banner-v1.png' alt='' width={2048} height={683} loading='lazy' decoding='async' />
      <span className='hall-promo__veil' aria-hidden='true' />
      <div className='hall-promo__copy'>
        <h2 className='hall-promo__title'>Sảnh thiền</h2>
        <span className='hall-promo__description'>Một chút bình yên giữa ngày.</span>
        <span className='hall-promo__cta'>Vào sảnh thiền <span aria-hidden='true'>↗</span></span>
      </div>
    </Link>
  )
}
