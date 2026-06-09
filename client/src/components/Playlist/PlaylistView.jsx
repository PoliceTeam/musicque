import React, { useContext } from 'react'
import { List, Space, Typography, Card, Empty, Input } from 'antd'
import { YoutubeOutlined } from '@ant-design/icons'
import { PlaylistContext } from '../../contexts/PlaylistContext'
import { AuthContext } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { message } from 'antd'
import QuickReactionButtons from '../Home/QuickReactionButtons'

const { Text } = Typography

const PlaylistView = () => {
  const { isDark } = useTheme()
  const { playlist, voteSong, loading, getUserVoteForSong, getLastReactionForSong } =
    useContext(PlaylistContext)
  const { username, setUserName } = useContext(AuthContext)

  const handleVote = async (songId, voteType, reactionEmoji) => {
    if (!username || username.trim() === '') {
      message.error('Vui lòng nhập tên của bạn trước khi vote')
      return false
    }

    if (voteType === 'neutral') {
      const currentVote = getUserVoteForSong(songId)
      if (!currentVote) return false
      return voteSong(songId, currentVote, reactionEmoji)
    }

    return voteSong(songId, voteType, reactionEmoji)
  }

  const handleUsernameChange = (e) => {
    setUserName(e.target.value)
  }

  return (
    <Card
      title='Playlist hiện tại'
      style={{
        background: isDark ? '#1f1f1f' : undefined,
      }}
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
          const userVote = getUserVoteForSong(song._id)
          const lastReactionEmoji = getLastReactionForSong(song._id)

          return (
            <List.Item
              actions={[
                <QuickReactionButtons
                  key={song._id}
                  songId={song._id}
                  onVote={handleVote}
                  userVote={userVote}
                  lastReactionEmoji={lastReactionEmoji}
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
