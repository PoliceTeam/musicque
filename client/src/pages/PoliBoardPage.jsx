import React, { Suspense } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { Button, Input } from 'antd'
import { LeftOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const PoliBoardApp = React.lazy(() => import('poliboard/Board'))

export default function PoliBoardPage() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  
  const [username, setUsername] = React.useState(() => localStorage.getItem('poliboard_username') || '')

  const handleUsernameChange = (e) => {
    const val = e.target.value
    setUsername(val)
    localStorage.setItem('poliboard_username', val)
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden', padding: '16px 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', background: isDark ? '#141414' : '#fff' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button 
          icon={<LeftOutlined />} 
          onClick={() => navigate('/')} 
          type="text" 
          style={{ color: isDark ? '#fff' : '#000' }}
        >
          Quay lại Music App
        </Button>
        <Input 
          prefix={<UserOutlined style={{ color: 'rgba(0,0,0,.25)' }} />}
          placeholder="Nhập tên của bạn..." 
          value={username}
          onChange={handleUsernameChange}
          style={{ width: 240 }}
        />
      </div>
      <Suspense fallback={<div style={{ color: isDark ? '#fff' : '#000' }}>Đang tải PoliBoard...</div>}>
        <div style={{ height: 'calc(100vh - 80px)', borderRadius: 8, overflow: 'hidden', border: isDark ? '1px solid #303030' : '1px solid #e8e8e8' }}>
          <PoliBoardApp roomId="musicque-global-board" username={username} />
        </div>
      </Suspense>
    </div>
  )
}
