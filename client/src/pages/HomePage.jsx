import React, { useContext } from 'react'
import { Layout, Typography, Row, Col, Card, Button, Input, Space } from 'antd'
import { UserOutlined, LoginOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import AddSongForm from '../components/Playlist/AddSongForm'
import PlaylistView from '../components/Playlist/PlaylistView'
import { PlaylistContext } from '../contexts/PlaylistContext'
import { AuthContext } from '../contexts/AuthContext'

const { Header, Content, Footer } = Layout
const { Title, Text } = Typography

const HomePage = () => {
  const { currentSession } = useContext(PlaylistContext)
  const { isAdmin, username, setUserName, logoutAdmin } = useContext(AuthContext)

  const handleUsernameChange = (e) => {
    setUserName(e.target.value)
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
            <Link to='/login'>
              <Button type='primary' icon={<LoginOutlined />}>
                Admin Login
              </Button>
            </Link>
          )}
        </Space>
      </Header>

      <Content style={{ padding: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card title={currentSession ? 'Thêm bài hát' : 'Thông báo'}>
              {currentSession ? (
                <AddSongForm />
              ) : (
                <div>
                  <Text>Hiện tại không có phiên phát nhạc nào đang diễn ra.</Text>
                  <br />
                  <Text type='secondary'>
                    Phiên phát nhạc chỉ được mở từ 15:00 đến 18:00 hàng ngày.
                  </Text>
                </div>
              )}
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <PlaylistView />
          </Col>
        </Row>
      </Content>

      <Footer style={{ textAlign: 'center' }}>Music Order App ©{new Date().getFullYear()}</Footer>
    </Layout>
  )
}

export default HomePage
