import React, { useContext } from 'react';
import { Typography, Tag, Space } from 'antd';
import { PlayCircleFilled, SoundOutlined } from '@ant-design/icons';
import { PlaylistContext } from '../../contexts/PlaylistContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getYouTubeThumbnail } from '../../utils/reactions';

const { Text } = Typography;

const NowPlayingBar = () => {
  const { currentSong, currentSession } = useContext(PlaylistContext);
  const { isDark } = useTheme();

  if (!currentSession || !currentSong) {
    return null;
  }

  const thumbnail = getYouTubeThumbnail(currentSong.youtubeId);

  return (
    <div
      data-testid="now-playing-bar"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '10px 24px',
        background: isDark ? '#162312' : '#f6ffed',
        borderBottom: `1px solid ${isDark ? '#274916' : '#b7eb8f'}`,
        boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.35)' : '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <Space align="center" size={12} style={{ width: '100%' }}>
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={currentSong.title}
            style={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 6 }}
          />
        ) : (
          <SoundOutlined style={{ fontSize: 28, color: '#52c41a' }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Space wrap size={8}>
            <Text strong style={{ color: isDark ? '#fff' : '#141414' }}>
              Đang phát
            </Text>
            <Tag color="success" icon={<PlayCircleFilled />}>
              Live
            </Tag>
          </Space>
          <div>
            <Text
              strong
              ellipsis
              style={{ display: 'block', color: isDark ? '#fff' : '#141414' }}
            >
              {currentSong.title}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {currentSong.addedBy?.username}
              {currentSong.message ? ` · "${currentSong.message}"` : ''}
            </Text>
          </div>
        </div>
      </Space>
    </div>
  );
};

export default NowPlayingBar;
