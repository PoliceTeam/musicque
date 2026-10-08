import React from 'react'
import { Link } from 'react-router-dom'
import UserMenu from '../components/Auth/UserMenu'
import CardFan from '../components/Thirteen/CardFan'
import { CARD_GAMES } from '../utils/cardGames'
// Cùng ngôn ngữ thiết kế với các thẻ Ma Sói / Cờ thú / Game bài ở sidebar Home (poster bo tròn, eyebrow, tiêu đề in hoa,
// pill trạng thái) trên bốn màu Politetech. Kiểu dáng nằm hết trong styles/card-lobby.css.
export default function CardGamesPage() {
  return <div className='thirteen-page cgl-page'>
    <header className='cgl-header'>
      <Link to='/' className='sp-btn sp-btn--ghost cgl-back'>← Về trang chủ</Link>
      <div className='cgl-title'><span className='cgl-eyebrow'><i className='cgl-dots' aria-hidden='true' />SẢNH GAME BÀI · POLITETECH</span><h1>Game bài</h1><p>Chọn một game để vào sảnh</p></div>
      <div className='cgl-header__actions'><UserMenu /></div>
    </header>
    <main>
      <div className='cgl-hub'>{CARD_GAMES.map(game => game.available
        ? <section className={`cgl-poster cgl-tile cgl-tile--hero cgl-tone--${game.tone}`} key={game.id}>
          <CardFan />
          <div className='cgl-tile__copy'>
            <span className='cgl-eyebrow'>SẴN SÀNG · MỞ CỬA</span>
            <h2>{game.name}</h2>
            <p>{game.tagline}</p>
            <div className='cgl-tile__row'>
              <span className='cgl-pill'><i />{game.players} người · bot lấp ghế trống</span>
              <Link to={game.path} className='cgl-cta' aria-label={`Vào sảnh ${game.name}`}>Vào sảnh <span aria-hidden='true'>→</span></Link>
            </div>
          </div>
        </section>
        : <section className={`cgl-tile cgl-tile--soon cgl-tone--${game.tone}`} key={game.id}>
          <h2>{game.name}</h2>
          {/* Không phải link: button aria-disabled vẫn focus được nên trình đọc màn hình đọc ra "Sắp ra mắt". */}
          <button type='button' className='cgl-pill' aria-disabled='true' aria-label={`${game.name} — Sắp ra mắt`}>Sắp ra mắt</button>
        </section>)}</div>
    </main>
  </div>
}
