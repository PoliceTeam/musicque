import React, { useContext, useEffect, useState } from 'react'
import { List, Button, Space, Typography, Card, Empty, Input, Tag } from 'antd'
import {
  UpOutlined,
  DownOutlined,
  YoutubeOutlined,
  PlayCircleFilled,
  SoundOutlined,
} from '@ant-design/icons'
import { PlaylistContext } from '../../contexts/PlaylistContext'
import { AuthContext } from '../../contexts/AuthContext'
import { message } from 'antd'
import { getCurrentSong } from '../../services/api'
import { useLocation } from 'react-router-dom'

const { Text, Title } = Typography

const PlaylistView = () => {
  const { playlist, voteSong, loading, playing } = useContext(PlaylistContext)
  const { username, setUserName } = useContext(AuthContext)
  const [currentSong, setCurrentSong] = useState(null)
  const location = useLocation()
  const isHomePage = location.pathname === '/'

  useEffect(() => {
    const fetchCurrentSong = async () => {
      if (!isHomePage) return // Chỉ fetch khi ở trang chủ

      try {
        const response = await getCurrentSong()
        setCurrentSong(response.data.currentSong)
      } catch (error) {
        console.error('Error fetching current song:', error)
      }
    }
    fetchCurrentSong()
  }, [playlist, isHomePage])

  const handleVote = async (songId, voteType) => {
    if (!username || username.trim() === '') {
      message.error('Vui lòng nhập tên của bạn trước khi vote')
      return
    }
    await voteSong(songId, voteType, playing)
  }

  const handleUsernameChange = (e) => {
    setUserName(e.target.value)
  }

  return (
    <Card
      title='Playlist hiện tại'
      extra={
        <Input
          placeholder='Nhập tên của bạn'
          value={username}
          onChange={handleUsernameChange}
          style={{ width: 150 }}
        />
      }
    >
      {isHomePage && currentSong && (
        <Card
          size='small'
          style={{
            marginBottom: 16,
            background: '#f6ffed',
            borderColor: '#b7eb8f',
          }}
        >
          <Space align='start'>
            <SoundOutlined style={{ fontSize: 24, color: '#52c41a' }} />
            <Space direction='vertical' size={0}>
              <Space>
                <Text strong>Đang phát:</Text>
                <Text>{currentSong.title}</Text>
                <Tag color='success' icon={<PlayCircleFilled />}>
                  Playing
                </Tag>
              </Space>
              <Text type='secondary'>Thêm bởi: {currentSong.addedBy.username}</Text>
              {currentSong.message && (
                <Text italic type='secondary'>
                  "{currentSong.message}"
                </Text>
              )}
            </Space>
          </Space>
        </Card>
      )}

      <List
        loading={loading}
        dataSource={playlist}
        renderItem={(song) => {
          const userVote = song.votes.find(
            (vote) => vote.userId && vote.userId.username === username,
          )?.type

          return (
            <List.Item
              actions={[
                <Button
                  type={userVote === 'up' ? 'primary' : 'default'}
                  icon={<UpOutlined />}
                  onClick={() => handleVote(song._id, 'up')}
                />,
                <Button
                  type={userVote === 'down' ? 'primary' : 'default'}
                  icon={<DownOutlined />}
                  onClick={() => handleVote(song._id, 'down')}
                />,
              ]}
            >
              <List.Item.Meta
                avatar={<YoutubeOutlined style={{ fontSize: 24, color: 'red' }} />}
                title={song.title}
                description={
                  <Space direction='vertical'>
                    <Text type='secondary'>Thêm bởi: {song.addedBy.username}</Text>
                    {song.message && <Text italic>"{song.message}"</Text>}
                    <Text strong>Votes: {song.voteScore}</Text>
                  </Space>
                }
              />
            </List.Item>
          )
        }}
        locale={{ emptyText: <Empty description='Chưa có bài hát nào trong playlist' /> }}
      />
    </Card>
  )
}

export default PlaylistView
