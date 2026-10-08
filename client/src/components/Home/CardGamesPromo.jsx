import React from 'react'
import { Link } from 'react-router-dom'
import { CARD_GAMES } from '../../utils/cardGames'
import './card-games-promo.css'

const CARDS = [['A', '♠', false], ['K', '♥', true], ['Q', '♣', false]]
const SOON = CARD_GAMES.filter(game => !game.available).length

// Thẻ gọi vào sảnh game bài ở sidebar Home, cùng kiểu poster với Ma Sói và Cờ thú: bàn nỉ xanh, ba lá bài xoè quạt.
export default function CardGamesPromo() {
  return <Link to='/games' className='cg-launch' aria-label='Vào sảnh game bài'>
    <span className='cg-launch__felt' aria-hidden='true' />
    <span className='cg-launch__cards' aria-hidden='true'>
      {CARDS.map(([rank, suit, red], i) => <span key={suit} className={`cg-launch__card${red ? ' is-red' : ''}`} style={{ '--i': i }}><b>{rank}</b><i>{suit}</i></span>)}
    </span>
    <span className='cg-launch__copy'>
      <span className='cg-launch__eyebrow'>SẢNH BÀI · 2–4 NGƯỜI</span>
      <strong className='cg-launch__title'>GAME BÀI</strong>
      <span className='cg-launch__tagline'>Tiến Lên · Phỏm · Ba Cây · …</span>
      <span className='cg-launch__status'><i />Tiến Lên mở · +{SOON} sắp ra mắt</span>
    </span>
  </Link>
}
