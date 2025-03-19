import React, { useContext, useEffect, useState } from 'react'
import { List, Button, Space, Typography, Card, Empty, Input } from 'antd'
import { UpOutlined, DownOutlined, YoutubeOutlined } from '@ant-design/icons'
import { PlaylistContext } from '../../contexts/PlaylistContext'
import { AuthContext } from '../../contexts/AuthContext'
import { message } from 'antd'

const { Text } = Typography

const PlaylistView = () => {
  const { playlist, voteSong, loading, playing } = useContext(PlaylistContext)
  const { username, setUserName } = useContext(AuthContext)

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
