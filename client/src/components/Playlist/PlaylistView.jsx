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
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
          <span style={{ fontSize: 24 }}>🎵</span>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Playlist hiện tại</span>
        </div>
      }
      bordered={false}
      style={{ background: 'var(--bg-card)', borderRadius: 24 }}
      bodyStyle={{ padding: '0 24px 24px 24px' }}
      headStyle={{ padding: '12px 24px', borderBottom: '1px solid var(--border)' }}
    >
      <List
        loading={loading}
        dataSource={playlist}
        renderItem={(song) => {
          const userVote = getUserVoteForSong(song._id)
          const lastReactionEmoji = getLastReactionForSong(song._id)

          return (
            <List.Item
              style={{ padding: '24px 0', borderBottom: '1px solid var(--border)' }}
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
                avatar={
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <YoutubeOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
                  </div>
                }
                title={<span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{song.title}</span>}
                description={
                  <Space direction='vertical' size={2} style={{ marginTop: 4 }}>
                    <Text type='secondary' style={{ fontSize: 13 }}>Thêm bởi: <span style={{ fontWeight: 600 }}>{song.addedBy.username}</span></Text>
                    {song.message && <Text italic style={{ color: 'var(--text-secondary)' }}>"{song.message}"</Text>}
                    <Text style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, marginTop: 4 }}>🔥 {song.voteScore} Votes</Text>
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
