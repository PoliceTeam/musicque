import React, { Suspense } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { Button, Input, Modal, Typography, Space, Divider, Row, Col, Card } from 'antd'
import { 
  LeftOutlined, 
  UserOutlined, 
  QuestionCircleOutlined,
  EditOutlined,
  CloudSyncOutlined,
  ExpandOutlined,
  TeamOutlined,
  RocketOutlined,
} from '@ant-design/icons'

const { Title, Paragraph, Text } = Typography
import { useNavigate } from 'react-router-dom'

const PoliBoardApp = React.lazy(() => import('poliboard/Board'))

export default function PoliBoardPage() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  
  const [username, setUsername] = React.useState(() => localStorage.getItem('poliboard_username') || '')
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  
  // Easter egg state
  const [clickCount, setClickCount] = React.useState(0)
  const [showKofi, setShowKofi] = React.useState(false)

  const handleUsernameChange = (e) => {
    const val = e.target.value
    setUsername(val)
    localStorage.setItem('poliboard_username', val)
  }

  const handleTitleClick = () => {
    const newCount = clickCount + 1
    if (newCount >= 5) {
      setShowKofi(true)
    } else {
      setClickCount(newCount)
    }
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
        <Button 
          icon={<QuestionCircleOutlined />} 
          onClick={() => setIsModalOpen(true)}
          type="text"
          style={{ color: isDark ? '#fff' : '#000', fontSize: '18px' }}
        />
      </div>

      <Modal
        title={null}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={720}
        bodyStyle={{ padding: 0, overflow: 'hidden', borderRadius: '12px' }}
        centered
      >
        <div style={{ 
          background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)', 
          padding: '40px 24px', 
          textAlign: 'center',
          color: '#fff',
          userSelect: 'none' // Prevent text selection when clicking rapidly
        }}>
          <Title 
            level={2} 
            style={{ color: '#fff', marginBottom: 8, cursor: 'pointer' }}
            onClick={handleTitleClick}
          >
            🎨 PoliBoard
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.85)', fontSize: '16px' }}>
            Bảng vẽ cộng tác thời gian thực cho mọi ý tưởng sáng tạo
          </Paragraph>
        </div>

        <div style={{ padding: '32px 40px', background: isDark ? '#1f1f1f' : '#fff' }}>
          <Title level={4} style={{ marginBottom: 24 }}>🌟 Tính năng nổi bật</Title>
          
          <Row gutter={[24, 24]}>
            <Col span={12}>
              <Space align="start">
                <div style={{ background: '#e6f7ff', padding: '8px', borderRadius: '8px' }}>
                  <TeamOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
                </div>
                <div>
                  <Text strong>Cùng nhau sáng tạo</Text>
                  <Paragraph type="secondary" style={{ fontSize: '13px', marginBottom: 0 }}>
                    Thấy nét vẽ và con trỏ của mọi người ngay lập tức.
                  </Paragraph>
                </div>
              </Space>
            </Col>
            <Col span={12}>
              <Space align="start">
                <div style={{ background: '#f9f0ff', padding: '8px', borderRadius: '8px' }}>
                  <ExpandOutlined style={{ fontSize: '20px', color: '#722ed1' }} />
                </div>
                <div>
                  <Text strong>Không gian vô hạn</Text>
                  <Paragraph type="secondary" style={{ fontSize: '13px', marginBottom: 0 }}>
                    Phóng to, thu nhỏ và di chuyển không giới hạn.
                  </Paragraph>
                </div>
              </Space>
            </Col>
            <Col span={12}>
              <Space align="start">
                <div style={{ background: '#fff7e6', padding: '8px', borderRadius: '8px' }}>
                  <EditOutlined style={{ fontSize: '20px', color: '#fa8c16' }} />
                </div>
                <div>
                  <Text strong>Công cụ linh hoạt</Text>
                  <Paragraph type="secondary" style={{ fontSize: '13px', marginBottom: 0 }}>
                    Bút vẽ, tẩy, màu sắc và kích thước đa dạng.
                  </Paragraph>
                </div>
              </Space>
            </Col>
            <Col span={12}>
              <Space align="start">
                <div style={{ background: '#f6ffed', padding: '8px', borderRadius: '8px' }}>
                  <CloudSyncOutlined style={{ fontSize: '20px', color: '#52c41a' }} />
                </div>
                <div>
                  <Text strong>Tự động lưu trữ</Text>
                  <Paragraph type="secondary" style={{ fontSize: '13px', marginBottom: 0 }}>
                    Dữ liệu được lưu an toàn và làm sạch mỗi ngày.
                  </Paragraph>
                </div>
              </Space>
            </Col>
          </Row>

          <Divider style={{ margin: '32px 0' }} />

          <Card 
            size="small" 
            style={{ 
              background: isDark ? '#262626' : '#fafafa', 
              border: 'none',
              borderRadius: '8px'
            }}
          >
            <Title level={5}><RocketOutlined /> Mẹo nhỏ cho bạn</Title>
            <ul style={{ paddingLeft: '20px', color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)', fontSize: '13px' }}>
              <li>Nhập <Text strong>tên của bạn</Text> ở góc trên để bạn bè nhận ra.</li>
              <li>Dùng <Text code>Cuộn chuột</Text> hoặc <Text code>Trackpad</Text> để Zoom & Pan.</li>
              <li>Mọi thứ sẽ được làm sạch vào <Text strong>00:00</Text> hàng ngày.</li>
            </ul>
          </Card>

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              Thấy PoliBoard hữu ích? <span style={{ opacity: 0.5 }}>(Bạn có biết nếu gõ cửa "🎨 PoliBoard" 5 lần, một điều kỳ diệu sẽ xảy ra không? ✨)</span>
            </Text>
            {showKofi && (
              <div style={{ marginTop: 12, animation: 'fadeIn 0.5s ease-in-out' }}>
                <a 
                  href="https://ko-fi.com/andiez02" 
                  target="_blank" 
                  rel="noreferrer"
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    padding: '8px 16px',
                    background: '#ff5f5f',
                    color: '#fff',
                    borderRadius: '20px',
                    textDecoration: 'none',
                    fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(255, 95, 95, 0.4)'
                  }}
                >
                  Buy me a token here! ☕️
                </a>
              </div>
            )}
          </div>

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Button 
              type="primary" 
              size="large" 
              onClick={() => setIsModalOpen(false)}
              style={{ 
                height: '48px', 
                padding: '0 40px', 
                borderRadius: '24px',
                background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(24, 144, 255, 0.35)'
              }}
            >
              Bắt đầu vẽ ngay 🚀
            </Button>
          </div>
        </div>
      </Modal>
      <Suspense fallback={<div style={{ color: isDark ? '#fff' : '#000' }}>Đang tải PoliBoard...</div>}>
        <div style={{ height: 'calc(100vh - 80px)', borderRadius: 8, overflow: 'hidden', border: isDark ? '1px solid #303030' : '1px solid #e8e8e8' }}>
          <PoliBoardApp roomId="musicque-global-board" username={username} />
        </div>
      </Suspense>
    </div>
  )
}
