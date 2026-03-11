import React from 'react';
import { Row, Col, Space, Button, Typography } from 'antd';
import { ArrowLeftOutlined, TeamOutlined, FireOutlined, ThunderboltOutlined, ClockCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function LunchHeader({
  teamName,
  displayName,
  phase,
  label,
  countdownText,
  handleBackToMusic,
  setStep,
}) {
  const getPhaseIcon = () => {
    if (phase === 'beforeNoon') return <FireOutlined />;
    if (phase === 'randomWindow') return <ThunderboltOutlined />;
    return <ClockCircleOutlined />;
  };

  return (
    <div
      style={{
        borderRadius: 16,
        padding: '24px 28px',
        marginBottom: 24,
        background: '#4285F4',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
      }}
    >
      <div style={{ marginBottom: 12, position: 'relative', zIndex: 1 }}>
        <Space>
          <Button
            type='text'
            size='small'
            icon={<ArrowLeftOutlined />}
            onClick={handleBackToMusic}
            style={{ color: '#e5efff', padding: 0, fontSize: 13, fontWeight: 500 }}
          >
            Về Music app
          </Button>
          <Button
            type='text'
            size='small'
            icon={<TeamOutlined />}
            onClick={() => setStep('setup')}
            style={{ color: 'rgba(255,255,255,0.9)', padding: 0, fontSize: 13 }}
          >
            Đổi team
          </Button>
        </Space>
      </div>
      <div
        style={{
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          animation: 'float 6s ease-in-out infinite',
        }}
      />
      
      <Row align='middle' justify='space-between' style={{ position: 'relative', zIndex: 1 }}>
        <Col>
          <Space direction='vertical' size={4}>
            <Title
              level={2}
              style={{
                color: '#fff',
                margin: 0,
                textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                fontWeight: 700,
                letterSpacing: '0.5px',
              }}
            >
              🍽️ Lunch Vote
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>
              Team <strong style={{ color: '#fff' }}>{teamName}</strong> · Xin chào{' '}
              <strong style={{ color: '#fff' }}>{displayName}</strong> – Hôm nay ăn gì?
            </Text>
          </Space>
        </Col>
        
        <Col>
          <div
            style={{
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              borderRadius: 12,
              padding: '12px 20px',
              textAlign: 'center',
            }}
          >
            <Space size={8} style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>
              {getPhaseIcon()}
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{label}</Text>
            </Space>
            <div
              className='countdown-number'
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: '#fff',
                letterSpacing: 2,
              }}
            >
              {countdownText}
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
}
