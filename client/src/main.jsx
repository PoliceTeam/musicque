import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './styles/spotify.css'
import './styles/chohan.css'
import './styles/billiards.css'
import './styles/news.css'
import './styles/xiangqi.css'
import './styles/wordchain.css'
import './styles/redlight.css'
import './styles/lottery.css'
import './styles/thirteen.css'
import './styles/card-lobby.css'
import './styles/card-table.css'

// Cache model 3D / ảnh sân khấu / nhạc theo tên file (xem public/asset-sw.js): lần sau vào không phải tải lại.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/asset-sw.js').catch((error) => console.warn('[Cache] Không đăng ký được service worker:', error))
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
