import React from 'react'
import { Link } from 'react-router-dom'
export default function CardGamesPromo() {
  return <Link to='/games' className='sp-panel card-games-promo'><span aria-hidden='true'>♠</span><div><strong>Game bài</strong><p>Tiến Lên · Phỏm · Ba Cây · …</p></div><b>Chọn game →</b></Link>
}
