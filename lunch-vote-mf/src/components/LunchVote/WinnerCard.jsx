import React from 'react';
import { Card, Space, Typography, Tag, Button } from 'antd';
import { TrophyOutlined, CrownOutlined, LikeOutlined, EnvironmentOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function WinnerCard({ winnerOption }) {
  if (!winnerOption) return null;

  return (
    <Card
      className='lunch-vote-winner-card'
      style={{
        borderRadius: 16,
        border: '2px solid #fbbf24',
        background: 'linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)',
        boxShadow: '0 8px 32px rgba(251, 191, 36, 0.25)',
      }}
      bodyStyle={{ padding: 20 }}
    >
      <Space direction='vertical' style={{ width: '100%' }} size={12}>
        <Space>
          <TrophyOutlined style={{ color: '#f59e0b', fontSize: 24 }} />
          <Text strong style={{ fontSize: 16, color: '#92400e' }}>Hôm nay ăn ở đây!</Text>
        </Space>
        
        <Title level={3} style={{ margin: 0, color: '#78350f' }}>
          {winnerOption.placeName}
        </Title>
        
        <Space>
          <Tag color='gold' style={{ borderRadius: 12 }}>
            <CrownOutlined /> #{1}
          </Tag>
          <Tag color='purple' style={{ borderRadius: 12 }}>
            <LikeOutlined /> {winnerOption.votes || 0} phiếu
          </Tag>
        </Space>
        
        <Button
          type='primary'
          icon={<EnvironmentOutlined />}
          href={winnerOption.mapsUrl}
          target='_blank'
          block
          style={{
            background: '#f59e0b',
            borderColor: '#f59e0b',
            borderRadius: 10,
            height: 40,
          }}
        >
          Mở Google Maps
        </Button>
      </Space>
    </Card>
  );
}
