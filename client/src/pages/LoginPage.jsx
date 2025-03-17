import React, { useState, useContext, useEffect } from 'react'
import { Form, Input, Button, Card, Typography, Layout, message } from 'antd'
import { UserOutlined, LockOutlined, HomeOutlined } from '@ant-design/icons'
import { AuthContext } from '../contexts/AuthContext'
import { useNavigate, Link } from 'react-router-dom'

const { Title } = Typography
const { Content } = Layout

const LoginPage = () => {
  const [loading, setLoading] = useState(false)
  const { loginAdmin, isAdmin } = useContext(AuthContext)
  const navigate = useNavigate()

  useEffect(() => {
    // Nếu đã đăng nhập, chuyển hướng đến trang admin
    if (isAdmin) {
      navigate('/admin')
    }
  }, [isAdmin, navigate])

  const handleSubmit = async (values) => {
    try {
      setLoading(true)
      const success = await loginAdmin(values.username, values.password)

      if (success) {
        message.success('Đăng nhập thành công')
        navigate('/admin')
      }
    } catch (error) {
      console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Card style={{ width: 400 }}>
          <div style={{ textAlign: 'right', marginBottom: 16 }}>
            <Link to='/'>
              <Button icon={<HomeOutlined />}>Trang chủ</Button>
            </Link>
          </div>

          <Title level={2} style={{ textAlign: 'center', marginBottom: 30 }}>
            Admin Login
          </Title>

          <Form name='login' onFinish={handleSubmit} layout='vertical'>
            <Form.Item
              name='username'
              rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập' }]}
            >
              <Input prefix={<UserOutlined />} placeholder='Tên đăng nhập' size='large' />
            </Form.Item>

            <Form.Item
              name='password'
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder='Mật khẩu' size='large' />
            </Form.Item>

            <Form.Item>
              <Button type='primary' htmlType='submit' size='large' block loading={loading}>
                Đăng nhập
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Content>
    </Layout>
  )
}

export default LoginPage
