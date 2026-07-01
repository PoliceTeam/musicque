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

  if (!currentSession) {
    return null; // Don't show at all outside of session
  }

  return (
    <div
      data-testid="now-playing-bar"
      className="floating-dock"
      style={{
        background: isDark ? 'rgba(30, 30, 30, 0.7)' : 'rgba(255, 255, 255, 0.8)',
      }}
    >
      {!currentSong ? (
        <Space align="center" size={12} style={{ width: '100%', opacity: 0.6 }}>
          <div style={{ width: 56, height: 42, background: isDark ? '#333' : '#e8e8e8', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SoundOutlined style={{ fontSize: 20 }} />
          </div>
          <div>
            <Text strong style={{ color: isDark ? '#fff' : '#141414', fontSize: '15px' }}>
              Chưa có nhạc
            </Text>
            <div style={{ fontSize: 12 }}>Đang chờ ai đó thêm bài hát...</div>
          </div>
        </Space>
      ) : (
        <Space align="center" size={12} style={{ width: '100%' }}>
          {getYouTubeThumbnail(currentSong.youtubeId) ? (
            <img
              src={getYouTubeThumbnail(currentSong.youtubeId)}
              alt={currentSong.title}
              style={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            />
          ) : (
            <div style={{ width: 56, height: 42, background: isDark ? '#333' : '#e8e8e8', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SoundOutlined style={{ fontSize: 20 }} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Space wrap size={8}>
              <Text strong style={{ color: isDark ? '#fff' : '#141414', fontSize: '15px' }}>
                Đang phát
              </Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: isDark ? 'rgba(82, 196, 26, 0.15)' : 'rgba(82, 196, 26, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                <div className="live-indicator" />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#52c41a', letterSpacing: '0.5px' }}>LIVE</span>
              </div>
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
      )}
    </div>
  );
};

export default NowPlayingBar;
