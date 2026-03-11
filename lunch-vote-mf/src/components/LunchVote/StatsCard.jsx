import React from 'react';
import { Card, Row, Col, Typography, Tag, Button } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function StatsCard({
  optionsLength,
  totalVotes,
  phase,
  handleRandom,
  randoming,
}) {
  const getPhaseColor = () => {
    if (phase === 'beforeNoon') return '#52c41a';
    if (phase === 'randomWindow') return '#faad14';
    return '#8c8c8c';
  };

  return (
    <Card
      style={{
        borderRadius: 16,
        border: 'none',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        marginBottom: 20,
      }}
      bodyStyle={{ padding: 20 }}
    >
      <Row gutter={16}>
        <Col span={8}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#4285F4' }}>{optionsLength}</div>
            <Text type='secondary' style={{ fontSize: 12 }}>Quán ăn</Text>
          </div>
        </Col>
        <Col span={8}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#EA4335' }}>{totalVotes}</div>
            <Text type='secondary' style={{ fontSize: 12 }}>Phiếu bầu</Text>
          </div>
        </Col>
        <Col span={8}>
          <div style={{ textAlign: 'center' }}>
            <Tag
              color={getPhaseColor()}
              style={{
                borderRadius: 20,
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {phase === 'beforeNoon' ? 'Đang vote' : phase === 'randomWindow' ? 'Random' : 'Đã kết thúc'}
            </Tag>
            <div style={{ marginTop: 4 }}>
              <Text type='secondary' style={{ fontSize: 12 }}>Trạng thái</Text>
            </div>
          </div>
        </Col>
      </Row>

      <Button
        type='primary'
        icon={<ThunderboltOutlined />}
        onClick={handleRandom}
        disabled={!totalVotes}
        loading={randoming}
        block
        size='large'
        className='random-btn'
        style={{ marginTop: 20, height: 48, borderRadius: 12, fontWeight: 600 }}
      >
        🎲 Random chọn quán!
      </Button>
    </Card>
  );
}
