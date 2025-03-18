import React, { useContext, useState } from 'react'
import { Card, Button, Typography, Space, Statistic } from 'antd'
import { PlayCircleOutlined, StopOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { PlaylistContext } from '../../contexts/PlaylistContext'

const { Text, Title } = Typography
const { Countdown } = Statistic

const SessionManager = () => {
  const { currentSession, startSession, endSession } = useContext(PlaylistContext)
  const [loading, setLoading] = useState(false)

  const handleStartSession = async () => {
    try {
      setLoading(true)
      await startSession()
    } catch (error) {
      console.error('Error starting session:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEndSession = async () => {
    try {
      setLoading(true)
      await endSession()
    } catch (error) {
      console.error('Error ending session:', error)
    } finally {
      setLoading(false)
    }
  }

  // Kiểm tra thời gian hiện tại có nằm trong khoảng 15:00-18:00 không
  const isWithinAllowedTime = () => {
    const now = new Date()
    const hours = now.getHours()
    return hours >= 0 && hours < 24
  }

  // Tính thời gian còn lại đến 18:00
  const getEndTime = () => {
    const now = new Date()
    const end = new Date(now)
    end.setHours(18, 0, 0, 0)
    return end.getTime()
  }

  return (
    <Card title='Quản lý phiên phát nhạc'>
      {currentSession ? (
        <>
          <Title level={4}>Phiên đang diễn ra</Title>
          <Space direction='vertical' style={{ width: '100%' }}>
            <Text>Bắt đầu lúc: {new Date(currentSession.startTime).toLocaleString()}</Text>

            <Countdown title='Thời gian còn lại đến 18:00' value={getEndTime()} format='HH:mm:ss' />

            <Button
              type='primary'
              danger
              icon={<StopOutlined />}
              onClick={handleEndSession}
              loading={loading}
              block
            >
              Kết thúc phiên
            </Button>
          </Space>
        </>
      ) : (
        <>
          <Space direction='vertical' style={{ width: '100%' }}>
            <Text>Hiện không có phiên phát nhạc nào đang diễn ra</Text>

            {isWithinAllowedTime() ? (
              <Button
                type='primary'
                icon={<PlayCircleOutlined />}
                onClick={handleStartSession}
                loading={loading}
                block
              >
                Mở phiên mới
              </Button>
            ) : (
              <Text type='warning'>
                <ClockCircleOutlined /> Chỉ có thể mở phiên từ 15:00 đến 18:00
              </Text>
            )}
          </Space>
        </>
      )}
    </Card>
  )
}

export default SessionManager
