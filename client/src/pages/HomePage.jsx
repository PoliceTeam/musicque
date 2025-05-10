import React, { useContext, useState } from 'react'
import { Layout, Typography, Row, Col, Card, Button, Input, Space } from 'antd'
import {
  UserOutlined,
  LoginOutlined,
  DropboxOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import AddSongForm from '../components/Playlist/AddSongForm'
import PlaylistView from '../components/Playlist/PlaylistView'
import ChatBox from '../components/Chat/ChatBox'
import DiceGame from '../games/dice/DiceGame'
import { PlaylistContext } from '../contexts/PlaylistContext'
import { AuthContext } from '../contexts/AuthContext'

const { Header, Content, Footer } = Layout
const { Title, Text } = Typography

const HomePage = () => {
  const { currentSession } = useContext(PlaylistContext)
  const { isAdmin, username, setUserName, logoutAdmin } = useContext(AuthContext)
  const [showDiceGame, setShowDiceGame] = useState(false)
  const [finalValue, setFinalValue] = useState(null)

  const handleUsernameChange = (e) => {
    setUserName(e.target.value)
  }

  const handlePlayDice = () => {
    const randomValue = Math.floor(Math.random() * 6) + 1
    setFinalValue(randomValue)
    setShowDiceGame(true)
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
          Music Order App
        </Title>
        <Space>
          {!isAdmin && (
            <Input
              prefix={<UserOutlined />}
              placeholder='Tên của bạn'
              value={username}
              onChange={handleUsernameChange}
              style={{ width: 200 }}
            />
          )}

          {isAdmin ? (
            <Space>
              <Link to='/admin'>
                <Button type='primary'>Admin Dashboard</Button>
              </Link>
              <Button onClick={logoutAdmin} icon={<LoginOutlined />}>
                Đăng xuất
              </Button>
            </Space>
          ) : (
            <Space>
              <Button type='primary' icon={<DropboxOutlined />} onClick={handlePlayDice}>
                Chơi Xúc Xắc
              </Button>
              <Link to='/login'>
                <Button type='primary' icon={<LoginOutlined />}>
                  Admin Login
                </Button>
              </Link>
            </Space>
          )}
        </Space>
      </Header>

      <Content style={{ padding: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card title={currentSession ? 'Thêm bài hát' : 'Thông báo'}>
              {currentSession ? (
                <AddSongForm />
              ) : (
                <div>
                  <Text>Hiện tại không có phiên phát nhạc nào đang diễn ra.</Text>
                  <br />
                  <Text type='secondary'>
                    Phiên phát nhạc chỉ nên được mở từ 15:00 đến 18:00 hàng ngày.
                  </Text>
                </div>
              )}
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <PlaylistView />
          </Col>

          <Col xs={24} md={8}>
            <ChatBox />
          </Col>
        </Row>
      </Content>

      <Footer style={{ textAlign: 'center' }}>
        Polite Music Order ©{new Date().getFullYear()} - Iced Tea Team -{' '}
        <span style={{ fontSize: '12px', color: '#e0c9c8', fontWeight: 'bold' }}>
          100% Made with AI
        </span>
      </Footer>

      {/* Dice Game Modal */}
      {showDiceGame && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '500px',
              height: '500px',
              backgroundColor: '#fff',
              borderRadius: '8px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <Title level={4} style={{ margin: 0 }}>
                Cùng xoay nào
              </Title>
              <Button
                type='text'
                onClick={() => {
                  setShowDiceGame(false)
                  setFinalValue(null)
                }}
                style={{ fontSize: '20px' }}
              >
                ×
              </Button>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <DiceGame finalValue={finalValue} />
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

export default HomePage
