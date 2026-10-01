import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { io } from 'socket.io-client'
import { AuthContext } from './src/contexts/AuthContext'
import { PlaylistContext } from './src/contexts/PlaylistContext'
import SecretShiftPage from './src/pages/SecretShiftPage'
import TaskPanel from './src/components/SecretShift/TaskPanel'
import './src/index.css'
import './src/styles/spotify.css'
import './src/styles/chohan.css'

// Tài khoản giả chỉ dành cho trang thử; không thay token đăng nhập hiện có.
const demoRole = new URLSearchParams(location.search).get('role') === 'crew' ? 'crew' : 'saboteur'
const demoId = `${crypto.randomUUID()}-${demoRole}`
sessionStorage.setItem('shift_demo_user', demoId)
// Hiện menu trước; server thử tạo một trận riêng cùng ba BOT khi bấm tạo phòng.
sessionStorage.removeItem('musicque_shift_room')
const socket = io('http://localhost:5091', { auth: { demoId, demoRole } })
const user = { _id: `demo-${demoId}`, username: 'tester', displayName: 'Bạn · thử game', avatarId: 'cat', role: 'user' }
const auth = { user, displayName: user.displayName, balance: 0, requireAuth: () => true,
  logout: () => location.reload(), openAuthModal: () => {}, updateAvatar: async () => ({ ok: true }) }
const Demo = () => {
  const [challenge, setChallenge] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [stats, setStats] = useState('Đang đo FPS…')
  const [walk, setWalk] = useState(false)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(timer) }, [])
  useEffect(() => {
    const timer = setInterval(() => {
      const canvas = document.querySelector('.shift-canvas canvas')
      if (canvas?.dataset.fps) setStats(`${canvas.dataset.fps} FPS · 95% khung ≤ ${canvas.dataset.frameP95} ms`)
    }, 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!walk) return undefined
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']
    let step = 0; let held
    const change = () => {
      if (held) window.dispatchEvent(new KeyboardEvent('keyup', { key: held }))
      const canvas = document.querySelector('.shift-canvas canvas')
      canvas?.focus(); held = keys[step++ % keys.length]
      window.dispatchEvent(new KeyboardEvent('keydown', { key: held }))
    }
    change()
    const timer = setInterval(change, 1500)
    return () => { clearInterval(timer); window.dispatchEvent(new KeyboardEvent('keyup', { key: held })) }
  }, [walk])
  const preview = (kind) => setChallenge({ id: crypto.randomUUID(), kind, startedAt: Date.now(), code: '4826', order: [2, 0, 3, 1] })
  return <>
    <div style={{ padding: '10px 24px', background: '#f8e7b9', color: '#473718' }}>
      PHÒNG THỬ · Vai trò: {demoRole === 'crew' ? 'Nhân viên' : 'Kẻ phá hoại'} · Tạo phòng để chơi với 3 BOT.
      <a style={{ marginLeft: 12 }} href={`?role=${demoRole === 'crew' ? 'saboteur' : 'crew'}`}>Đổi vai trò</a>
      <div className='shift-buttons'>Xem thử mini game:
        <button className='sp-btn' onClick={() => preview('wiring')}>Nối dây</button>
        <button className='sp-btn' onClick={() => preview('code')}>Nhập mã</button>
        <button className='sp-btn' onClick={() => preview('restart')}>Khởi động</button>
        <button className='sp-btn' onClick={() => preview('navigation')}>Chỉnh hướng</button>
        <button className='sp-btn' onClick={() => preview('garbage')}>Đổ rác</button>
        <button className='sp-btn' onClick={() => preview('fuel')}>Cấp nhiên liệu</button>
      </div>
      <small>Bot chỉ đi lại và bỏ phiếu bỏ qua. Mini game xem thử không tính tiến độ; voice tắt.</small>
      <div>{stats} · <label><input style={{ width: 'auto' }} type='checkbox' checked={walk} onChange={e => setWalk(e.target.checked)} />Tự đi để đo FPS</label></div>
    </div>
    <SecretShiftPage />
    {challenge && <TaskPanel challenge={challenge} now={now} online act={async () => { setChallenge(null); return true }} />}
  </>
}
createRoot(document.getElementById('root')).render(
  <BrowserRouter><AuthContext.Provider value={auth}><PlaylistContext.Provider value={{ socket }}>
    <Demo />
  </PlaylistContext.Provider></AuthContext.Provider></BrowserRouter>
)
