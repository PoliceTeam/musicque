import React from 'react'
import { Link } from 'react-router-dom'
import UserMenu from '../components/Auth/UserMenu'
import { CARD_GAMES } from '../utils/cardGames'
// Bố cục theo sảnh Thirteen (thirteen-page / thirteen-header / lưới sp-panel) để cùng một kiểu giao diện.
export default function GamesPage() {
  return <div className='thirteen-page'>
    <header className='thirteen-header'><Link to='/' className='sp-btn sp-btn--ghost'>← Về trang chủ</Link><div><h1>Game bài</h1><p>Chọn một game để vào sảnh</p></div><UserMenu /></header>
    <main>
      <div className='thirteen-lobby'>{CARD_GAMES.map(game => <section className='sp-panel games-tile' key={game.id}>
        <div className='thirteen-status'><h2>{game.name}</h2>{game.available && <span className='thirteen-chip'>{game.players} người</span>}</div>
        {game.available
          ? <><p>{game.tagline}</p><Link to={game.path} className='sp-btn sp-btn--primary' aria-label={`Vào sảnh ${game.name}`}>Vào sảnh</Link></>
          // Không phải link: button aria-disabled vẫn focus được nên trình đọc màn hình đọc ra "Sắp ra mắt".
          : <button type='button' className='sp-btn' aria-disabled='true' aria-label={`${game.name} — Sắp ra mắt`}>Sắp ra mắt</button>}
      </section>)}</div>
    </main>
  </div>
}
