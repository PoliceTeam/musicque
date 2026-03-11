import React from 'react';
import { Card, Typography, Space, Input, Button } from 'antd';
import { UserOutlined, TeamOutlined, PlusOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function SetupCard({
  usernameInput,
  setUsernameInput,
  teamName,
  setTeamName,
  isCreatingTeam,
  setIsCreatingTeam,
  availableTeams,
  displayName,
  handleSetupSubmit,
  handleDeleteTeam,
  handleBackToMusic,
  submitting,
}) {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Card
        style={{
          maxWidth: 500,
          width: '100%',
          borderRadius: 24,
          border: 'none',
          boxShadow: '0 10px 40px rgba(0,0,0,0.08), 0 2px 10px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
        bodyStyle={{ padding: 0 }}
      >
        {/* Header strip */}
        <div
          style={{
            background: 'linear-gradient(135deg, #4285F4 0%, #3367D6 100%)',
            padding: '36px 28px',
            textAlign: 'center',
            position: 'relative',
          }}
        >
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
          <div style={{ fontSize: 44, marginBottom: 16, position: 'relative', zIndex: 1, textShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>🍽️</div>
          <Title level={3} style={{ margin: 0, color: '#fff', fontWeight: 700, position: 'relative', zIndex: 1, textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            Lunch Vote
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, marginTop: 8, display: 'block', position: 'relative', zIndex: 1 }}>
            Tham gia team của bạn để chốt đơn bữa trưa!
          </Text>
        </div>

        <div style={{ padding: '32px 28px' }}>
          {/* Username */}
          <div style={{ marginBottom: 28 }}>
            <Text strong style={{ fontSize: 14, color: '#475569', marginBottom: 12, display: 'block' }}>
              1. Tên hiển thị của bạn
            </Text>
            <Input
              size='large'
              placeholder='Ví dụ: Alice, Bob...'
              prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              style={{ borderRadius: 12, height: 48 }}
            />
          </div>

          {/* Team section */}
          <div style={{ marginBottom: 36 }}>
            <Text strong style={{ fontSize: 14, color: '#475569', marginBottom: 12, display: 'block' }}>
              2. Chọn Team để tham gia
            </Text>
            
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 12,
                marginBottom: isCreatingTeam ? 16 : 0
              }}
            >
              {availableTeams.map((teamObj) => {
                const tName = typeof teamObj === 'string' ? teamObj : teamObj.name
                const creator = typeof teamObj === 'string' ? null : teamObj.createdBy
                const selected = (teamName || '').trim() === tName && !isCreatingTeam
                return (
                  <div
                    key={tName}
                    className={`team-card ${selected ? 'active' : ''}`}
                    onClick={() => {
                      setTeamName(tName)
                      setIsCreatingTeam(false)
                    }}
                  >
                    {creator === displayName && (
                      <Button 
                        type="text" 
                        danger 
                        icon={<DeleteOutlined />} 
                        onClick={(e) => handleDeleteTeam(e, tName)}
                        size="small" 
                        style={{ position: 'absolute', top: 4, right: 4 }} 
                      />
                    )}
                    <TeamOutlined className="team-icon" />
                    <span className="team-name" title={tName}>{tName}</span>
                    {creator && creator !== 'System' && (
                      <Text type="secondary" style={{ fontSize: 11, marginTop: -4 }}>bởi {creator}</Text>
                    )}
                  </div>
                )
              })}
              <div
                className={`team-card team-card-create ${isCreatingTeam ? 'active' : ''}`}
                onClick={() => {
                  setTeamName('')
                  setIsCreatingTeam(true)
                }}
              >
                <PlusOutlined className="team-icon" />
                <span className="team-name">Tạo Team mới</span>
              </div>
            </div>

            {isCreatingTeam && (
              <div style={{ animation: 'fadeInDown 0.3s ease-out' }}>
                <Input
                  size='large'
                  placeholder='Nhập tên team mới...'
                  prefix={<TeamOutlined style={{ color: '#94a3b8' }} />}
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  onPressEnter={handleSetupSubmit}
                  style={{ borderRadius: 12, height: 48 }}
                  autoFocus
                />
              </div>
            )}
          </div>

          <Button
            type='primary'
            size='large'
            block
            className='gradient-btn'
            onClick={handleSetupSubmit}
            loading={submitting}
            style={{ height: 52, borderRadius: 14, fontSize: 16, fontWeight: 600, boxShadow: '0 8px 16px rgba(66, 133, 244, 0.25)' }}
          >
            {isCreatingTeam ? 'Tạo Team & Vào xem 🚀' : 'Vào bình chọn 🚀'}
          </Button>

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Button
              type='text'
              size='small'
              icon={<ArrowLeftOutlined />}
              onClick={handleBackToMusic}
              style={{ color: '#94a3b8', fontSize: 14, fontWeight: 500 }}
            >
              Về Music app
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
