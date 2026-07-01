import React from 'react'
import { Button, Layout, Space, Typography } from 'antd'
import { ArrowLeftOutlined, HomeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import WorldCupScheduleView from '../components/WorldCup/WorldCupScheduleView'
import { useTheme } from '../contexts/ThemeContext'
import '../components/WorldCup/WorldCup.css'

const { Header, Content } = Layout
const { Title, Text } = Typography

export default function WorldCupPage() {
  const navigate = useNavigate()
  const { isDark } = useTheme()

  return (
    <div className={`wc-page-shell ${isDark ? 'is-dark' : 'is-light'}`}>
      <header className="wc-page-header">
        <Space size={16} align="center">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
            className="wc-nav-btn"
          >
            Quay lại
          </Button>
          <div className="wc-header-title-stack">
            <h1 className="wc-header-title">World Cup 2026</h1>
            <span className="wc-header-subtitle">Lịch đấu, bảng xếp hạng và knockout</span>
          </div>
        </Space>
        <Button
          type="primary"
          icon={<HomeOutlined />}
          onClick={() => navigate('/')}
          className="wc-home-btn"
        >
          Trang chính
        </Button>
      </header>
      <main className="wc-page-content">
        <WorldCupScheduleView />
      </main>
    </div>
  )
}
