import React from 'react'
import { Link } from 'react-router-dom'
import './hall-promo.css'

export default function HallPromo() {
  return (
    <Link to='/hall' className='hall-promo' aria-label='Vào sảnh thiền'>
      <img className='hall-promo__art' src='/models/hall/home-banner-v1.png' alt='' width={2048} height={683} loading='lazy' decoding='async' />
      <span className='hall-promo__veil' aria-hidden='true' />
      <div className='hall-promo__copy'>
        <span className='hall-promo__eyebrow'>Sảnh thiền Musicque</span>
        <h2 className='hall-promo__title'>Một khoảng lặng giữa ngày.</h2>
        <span className='hall-promo__description'>Ngồi yên, thở chậm. Cùng nhau.</span>
        <span className='hall-promo__cta'>Vào sảnh thiền <span aria-hidden='true'>↗</span></span>
      </div>
      <span className='hall-promo__note' aria-hidden='true'>Một chỗ ngồi. Một nhịp thở.</span>
    </Link>
  )
}
