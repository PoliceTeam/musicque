import React from 'react'
const CARDS = [['A', '♠', false], ['K', '♥', true], ['Q', '♣', false], ['J', '♦', true], ['10', '♠', false]]
// Hình minh hoạ: các lá bài xoè quạt, dùng cho poster ở sảnh game bài và sảnh Tiến Lên. Trang trí nên ẩn khỏi trình đọc màn hình.
export default function CardFan({ count = 5 }) {
  return <span className='cgl-fan' aria-hidden='true' style={{ '--n': count }}>
    {CARDS.slice(0, count).map(([rank, suit, red], i) => <span key={i} className={`cgl-fan__card${red ? ' is-red' : ''}`} style={{ '--i': i }}><b>{rank}</b><i>{suit}</i></span>)}
  </span>
}
