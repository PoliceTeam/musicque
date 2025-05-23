import React, { useContext } from 'react'
import { Layout, Typography, Row, Col, Button, Space } from 'antd'
import { LogoutOutlined, HomeOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import SessionManager from '../components/Admin/SessionManager'
import MusicPlayer from '../components/Player/MusicPlayer'
import PlaylistView from '../components/Playlist/PlaylistView'
import ChatBox from '../components/Chat/ChatBox'
import { AuthContext } from '../contexts/AuthContext'

const { Header, Content, Footer } = Layout
const { Title } = Typography

const AdminPage = () => {
  const { logoutAdmin } = useContext(AuthContext)
  const navigate = useNavigate()

  const handleLogout = () => {
    logoutAdmin()
    navigate('/login')
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          background: '#fff',
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Title level={3} style={{ margin: '16px 0' }}>
          Admin Dashboard
        </Title>
        <Space>
          <Link to='/'>
            <Button icon={<HomeOutlined />}>Trang chủ</Button>
          </Link>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            Đăng xuất
          </Button>
        </Space>
      </Header>

      <Content style={{ padding: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <SessionManager />
          </Col>

          <Col xs={24} md={8}>
            <MusicPlayer />
          </Col>

          <Col xs={24} md={8}>
            <PlaylistView />
          </Col>

          {/* <Col xs={24} md={6}>
            <ChatBox />
          </Col> */}
        </Row>
      </Content>

      <Footer style={{ textAlign: 'center' }}>
        Polite Music Order ©{new Date().getFullYear()} - Iced Tea Team -{' '}
        <span style={{ fontSize: '12px', color: '#e0c9c8', fontWeight: 'bold' }}>
          100% Made with AI
        </span>
      </Footer>
    </Layout>
  )
}

export default AdminPage
