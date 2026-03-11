import React from 'react';
import { Space, Typography, Button } from 'antd';
import { getFoodEmoji } from './utils';

const { Text } = Typography;

export default function LunchWheelModal({
  showWheel,
  wheelOptions,
  wheelRotation,
  wheelWinner,
  randoming,
  setShowWheel,
  setWheelWinner,
}) {
  if (!showWheel || wheelOptions.length === 0) return null;

  return (
    <div className='lunch-wheel-overlay'>
      <div className='lunch-wheel-modal'>
        <Space direction='vertical' style={{ width: '100%' }} size={20} align='center'>
          <Text strong style={{ fontSize: 18, color: '#1e293b' }}>
            Vòng quay may mắn
          </Text>
          <div className='lunch-wheel-wrapper'>
            <div className='lunch-wheel-pointer' />
            <div className='lunch-wheel-circle'>
              <div
                className='lunch-wheel-inner'
                style={{ transform: `rotate(${wheelRotation}deg)` }}
              >
              {(() => {
                const n = wheelOptions.length;
                const segmentAngle = 360 / n;
                const conicStops = wheelOptions
                  .map((_, i) => {
                    const start = i * segmentAngle;
                    const end = (i + 1) * segmentAngle;
                    const hue = (i * 360) / n;
                    const color = `hsl(${hue}, 80%, 55%)`;
                    return `${color} ${start}deg ${end}deg`;
                  })
                  .join(', ');
                return (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background: `conic-gradient(from -90deg, ${conicStops})`,
                    }}
                  />
                );
              })()}
              {wheelOptions.map((o, index) => {
                const n = wheelOptions.length;
                const segmentAngle = 360 / n;
                const midAngle = index * segmentAngle + segmentAngle / 2 - 90;
                const radius = 100;
                const x = 150 + radius * Math.cos((midAngle * Math.PI) / 180);
                const y = 150 + radius * Math.sin((midAngle * Math.PI) / 180);
                return (
                  <div
                    key={o._id}
                    style={{
                      position: 'absolute',
                      left: x,
                      top: y,
                      transform: 'translate(-50%, -50%)',
                      background: 'rgba(255,255,255,0.95)',
                      padding: '4px 8px',
                      borderRadius: 8,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      textAlign: 'center',
                      zIndex: 2,
                      minWidth: 60,
                    }}
                  >
                    <div style={{ fontSize: 18 }}>{getFoodEmoji(o.placeName)}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: '#334155', lineHeight: 1.2 }}>
                      {o.placeName.length > 8 ? `${o.placeName.slice(0, 8)}...` : o.placeName}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
            <div className='lunch-wheel-center'>🍽️</div>
          </div>
          {wheelWinner ? (
            <div className='lunch-wheel-result'>
              <div className='lunch-wheel-result-title'>
                {getFoodEmoji(wheelWinner.placeName)} {wheelWinner.placeName}
              </div>
              <div className='lunch-wheel-result-votes'>
                {wheelWinner.votes || 0} phiếu bầu
              </div>
            </div>
          ) : (
            <Text type='secondary' style={{ fontSize: 13 }}>
              Đang quay... Mỗi quán có vote có xác suất trúng bằng nhau
            </Text>
          )}
          <Button
            type={wheelWinner ? 'primary' : 'default'}
            disabled={randoming}
            onClick={() => {
              if (randoming) return;
              setShowWheel(false);
              setWheelWinner(null);
            }}
            style={{
              borderRadius: 10,
              ...(wheelWinner && { backgroundColor: '#34A853', borderColor: '#34A853' }),
            }}
          >
            {wheelWinner ? 'Xác nhận' : 'Đóng'}
          </Button>
        </Space>
      </div>
    </div>
  );
}
