import React from 'react';
import { Card, Space, Typography, Input, Button } from 'antd';
import { EnvironmentOutlined, PlusOutlined, CheckCircleFilled } from '@ant-design/icons';

const { Text } = Typography;

export default function AddOptionCard({
  newMapsUrl,
  setNewMapsUrl,
  detectedName,
  manualName,
  setManualName,
  submitting,
  handleAddOption,
}) {
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
      <Space direction='vertical' style={{ width: '100%' }} size={16}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <EnvironmentOutlined style={{ color: '#667eea', fontSize: 18 }} />
          <Text strong style={{ fontSize: 15 }}>Thêm quán mới</Text>
        </div>
        
        <Input.Search
          placeholder='Dán link Google Maps...'
          enterButton={
            <Button
              type='primary'
              icon={<PlusOutlined />}
              loading={submitting}
              className='gradient-btn'
            >
              Thêm
            </Button>
          }
          size='large'
          value={newMapsUrl}
          onChange={(e) => setNewMapsUrl(e.target.value)}
          onSearch={handleAddOption}
          disabled={submitting}
          style={{ borderRadius: 10 }}
        />

        {detectedName ? (
          <div
            style={{
              background: '#E8F5E9',
              borderRadius: 8,
              padding: '10px 14px',
              border: '1px solid #86efac',
            }}
          >
            <Space>
              <CheckCircleFilled style={{ color: '#0F9D58' }} />
              <Text>
                Phát hiện:{' '}
                <Text strong style={{ color: '#0F9D58' }}>{detectedName}</Text>
              </Text>
            </Space>
          </div>
        ) : newMapsUrl ? (
          <Input
            placeholder='Nhập tên quán (nếu không tự nhận diện được)'
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            disabled={submitting}
            prefix={<EnvironmentOutlined style={{ color: '#bfbfbf' }} />}
          />
        ) : null}
      </Space>
    </Card>
  );
}
