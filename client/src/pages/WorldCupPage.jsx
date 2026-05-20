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
    <Layout className={`wc-page-shell ${isDark ? 'is-dark' : ''}`}>
      <Header
        className="wc-page-header"
      >
        <Space size={16} align="center">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            Quay lại
          </Button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <Title level={4} style={{ margin: 0, lineHeight: 1.2, fontSize: '16px' }}>
              World Cup 2026
            </Title>
            <Text type="secondary" style={{ fontSize: '12px', lineHeight: 1.2 }}>
              Lịch đấu, bảng xếp hạng và knockout
            </Text>
          </div>
        </Space>
        <Button
          type="primary"
          icon={<HomeOutlined />}
          onClick={() => navigate('/')}
          style={{ display: 'inline-flex', alignItems: 'center' }}
        >
          Trang chính
        </Button>
      </Header>
      <Content className="wc-page-content">
        <WorldCupScheduleView />
      </Content>
    </Layout>
  )
}
