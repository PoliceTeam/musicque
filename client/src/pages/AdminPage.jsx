import React from 'react'
import { Tooltip } from 'antd'
import { MoonOutlined, SunOutlined } from '@ant-design/icons'
import SidebarNav from '../components/Layout/SidebarNav'
import SessionManager from '../components/Admin/SessionManager'
import IdiomManager from '../components/Admin/IdiomManager'
import MusicPlayer from '../components/Player/MusicPlayer'
import PlaylistView from '../components/Playlist/PlaylistView'
import LiveActivityFeed from '../components/Home/LiveActivityFeed'
import UserMenu from '../components/Auth/UserMenu'
import { useTheme } from '../contexts/ThemeContext'

const AdminPage = () => {
  const { isDark, toggleTheme } = useTheme()

  return (
    <div className='sp-shell sp-shell--no-player'>
      <aside className='sp-sidebar'>
        <SidebarNav subtitle='Bảng điều khiển' />

        <SessionManager />

        <LiveActivityFeed />
      </aside>

      <main className='sp-main'>
        <header className='sp-topbar'>
          <h1 className='sp-topbar__greeting'>Điều khiển phiên phát nhạc</h1>
          <div className='sp-topbar__actions'>
            <Tooltip title={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}>
              <button
                type='button'
                className='sp-btn sp-btn--ghost sp-btn--icon'
                onClick={toggleTheme}
                aria-label='Đổi giao diện sáng/tối'
              >
                {isDark ? <SunOutlined /> : <MoonOutlined />}
              </button>
            </Tooltip>
            <UserMenu />
          </div>
        </header>

        <div
          style={{ padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}
        >
          <MusicPlayer />
          <IdiomManager />
        </div>
      </main>

      <aside className='sp-rail'>
        <PlaylistView title='Hàng chờ' compact />
      </aside>
    </div>
  )
}

export default AdminPage
