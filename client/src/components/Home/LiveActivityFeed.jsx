import React, { useContext } from 'react';
import { Card, List, Typography, Button, Empty } from 'antd';
import { ThunderboltOutlined, ClearOutlined } from '@ant-design/icons';
import { PlaylistContext } from '../../contexts/PlaylistContext';
import { useTheme } from '../../contexts/ThemeContext';
import useActivityFeed from '../../hooks/useActivityFeed';
import { formatActivityTime } from '../../utils/activityFeed';

const { Text } = Typography;

const toneColorMap = {
  success: '#52c41a',
  warning: '#faad14',
  processing: '#1677ff',
  default: undefined,
};

const LiveActivityFeed = () => {
  const { socket, currentSession } = useContext(PlaylistContext);
  const { isDark } = useTheme();
  const { items, clearItems } = useActivityFeed(socket);

  return (
    <Card
      size="small"
      data-testid="live-activity-feed"
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <ThunderboltOutlined />
          Hoạt động trực tiếp
        </span>
      }
      extra={
        items.length > 0 ? (
          <Button
            type="text"
            size="small"
            icon={<ClearOutlined />}
            onClick={clearItems}
            aria-label="Clear activity feed"
          />
        ) : null
      }
      style={{
        background: isDark ? '#1f1f1f' : '#fff',
        borderColor: isDark ? '#434343' : '#f0f0f0',
      }}
      styles={{
        body: {
          padding: 0,
          maxHeight: 280,
          overflowY: 'auto',
        },
      }}
    >
      {!currentSession ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Chờ phiên phát nhạc để xem hoạt động"
          style={{ padding: '16px 8px' }}
        />
      ) : items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Chưa có hoạt động nào"
          style={{ padding: '16px 8px' }}
        />
      ) : (
        <List
          dataSource={items}
          renderItem={(item) => (
            <List.Item style={{ padding: '10px 16px' }}>
              <List.Item.Meta
                avatar={<span style={{ fontSize: 18 }}>{item.icon}</span>}
                title={
                  <Text style={{ color: toneColorMap[item.tone] || undefined }}>
                    {item.text}
                  </Text>
                }
                description={
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {formatActivityTime(item.timestamp)}
                  </Text>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
};

export default LiveActivityFeed;
