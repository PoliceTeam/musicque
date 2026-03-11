import React from 'react';
import { Card, Space, Tag, Empty, Typography, Row, Col, Badge, Tooltip, Progress, Button } from 'antd';
import { EnvironmentOutlined, CrownOutlined, UserOutlined, LikeOutlined, CheckCircleFilled } from '@ant-design/icons';
import { getFoodEmoji } from './utils';

const { Text } = Typography;

export default function OptionList({
  sortedOptions,
  dateKey,
  loading,
  totalVotes,
  currentVoteOptionId,
  highlightedId,
  phase,
  submitting,
  handleVote,
  isDark = false, // Added isDark prop
}) {
  return (
    <Card
      title={
        <Space>
          <EnvironmentOutlined style={{ color: isDark ? '#60a5fa' : '#4285F4' }} />
          <span style={{ color: isDark ? '#f8fafc' : 'inherit' }}>Danh sách quán ({sortedOptions.length})</span>
          <Tag
            style={{
              marginLeft: 8,
              borderRadius: 10,
              backgroundColor: isDark ? '#3b82f6' : '#4285F4',
              color: '#fff',
              border: 'none',
            }}
          >
            Ngày {dateKey || '--'}
          </Tag>
        </Space>
      }
      style={{
        borderRadius: 16,
        border: isDark ? '1px solid #334155' : 'none',
        boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.15)' : '0 4px 20px rgba(0,0,0,0.08)',
        background: isDark ? '#1e293b' : '#fff',
      }}
      bodyStyle={{ padding: 16, maxHeight: 600, overflowY: 'auto' }}
      loading={loading}
    >
      {sortedOptions.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Text style={{ color: isDark ? '#94a3b8' : 'inherit' }} type={isDark ? undefined : 'secondary'}>
              Chưa có quán nào. Hãy thêm quán đầu tiên!
            </Text>
          }
        />
      ) : (
        <Space direction='vertical' style={{ width: '100%' }} size={12}>
          {sortedOptions.map((o, index) => {
            const votePercent = totalVotes ? Math.round(((o.votes || 0) / totalVotes) * 100) : 0;
            const isVoted = currentVoteOptionId === o._id;
            const isHighlighted = highlightedId === o._id;
            const isLeading = index === 0 && o.votes > 0;

            return (
              <div
                key={o._id}
                className='lunch-vote-option-card'
                style={{
                  background: isDark
                    ? isHighlighted
                      ? 'linear-gradient(135deg, #78350f 0%, #92400e 100%)'
                      : isLeading
                      ? 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)'
                      : '#334155'
                    : isHighlighted
                    ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
                    : isLeading
                    ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                    : '#fafafa',
                  borderRadius: 14,
                  padding: 16,
                  border: isDark
                    ? isHighlighted
                      ? '2px solid #fbbf24'
                      : isLeading
                      ? '1px solid #34d399'
                      : '1px solid #475569'
                    : isHighlighted
                    ? '2px solid #fbbf24'
                    : isLeading
                    ? '1px solid #86efac'
                    : '1px solid #f0f0f0',
                  boxShadow: isDark
                    ? isHighlighted
                      ? '0 0 0 4px rgba(251, 191, 36, 0.15), 0 8px 24px rgba(0,0,0,0.2)'
                      : '0 2px 8px rgba(0,0,0,0.15)'
                    : isHighlighted
                    ? '0 0 0 4px rgba(251, 191, 36, 0.2), 0 8px 24px rgba(0,0,0,0.12)'
                    : '0 2px 8px rgba(0,0,0,0.04)',
                  transform: isHighlighted ? 'scale(1.02)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <Row align='middle' gutter={12}>
                  <Col flex='none'>
                    <Badge
                      count={index + 1}
                      style={{
                        backgroundColor: isDark 
                          ? (isLeading ? '#10b981' : '#3b82f6')
                          : (isLeading ? '#34A853' : '#4285F4'),
                        fontWeight: 600,
                        color: '#fff',
                        boxShadow: isDark ? '0 0 0 1px #1e293b' : 'none',
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          backgroundColor: isDark
                            ? (isLeading ? '#059669' : '#2563eb')
                            : (isLeading ? '#34A853' : '#4285F4'),
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 22,
                          fontWeight: 700,
                          boxShadow: isDark ? 'inset 0 2px 4px rgba(255,255,255,0.1)' : 'none',
                        }}
                      >
                        {getFoodEmoji(o.placeName)}
                      </div>
                    </Badge>
                  </Col>
                  
                  <Col flex='1'>
                    <Space direction='vertical' size={4} style={{ width: '100%' }}>
                      <Space wrap>
                        <Text strong style={{ fontSize: 15, color: isDark ? '#f8fafc' : 'inherit' }}>{o.placeName}</Text>
                        {isLeading && (
                          <Tag 
                            color={isDark ? undefined : 'gold'}
                            style={isDark 
                              ? { borderRadius: 10, border: 'none', background: '#065f46', color: '#6ee7b7' }
                              : { borderRadius: 10 }
                            }
                          >
                            <CrownOutlined /> Đang dẫn đầu
                          </Tag>
                        )}
                      </Space>
                      
                      <Space size={12}>
                        <Tooltip title='Mở trên Google Maps'>
                          <a
                            href={o.mapsUrl}
                            target='_blank'
                            rel='noreferrer'
                            style={{ fontSize: 12, color: isDark ? '#60a5fa' : '#4285F4' }}
                          >
                            <EnvironmentOutlined /> Xem địa chỉ
                          </a>
                        </Tooltip>
                        {o.createdBy && (
                          <Text type={isDark ? undefined : 'secondary'} style={{ fontSize: 12, color: isDark ? '#94a3b8' : undefined }}>
                            <UserOutlined /> {o.createdBy}
                          </Text>
                        )}
                      </Space>
                      
                      <Progress
                        percent={votePercent}
                        size='small'
                        strokeColor={isDark ? (isLeading ? '#34d399' : '#60a5fa') : '#4285F4'}
                        trailColor={isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}
                        format={(p) => isDark 
                          ? <span style={{ color: '#cbd5e1', fontSize: 12 }}>{p}%</span>
                          : `${p}%`
                        }
                        style={{ marginBottom: 0 }}
                      />
                    </Space>
                  </Col>
                  
                  <Col flex='none'>
                    <Space direction='vertical' align='end' size={8}>
                      <Tag
                        color={isDark ? undefined : (isVoted ? 'green' : 'default')}
                        style={isDark
                          ? {
                              borderRadius: 20,
                              padding: '2px 10px',
                              fontWeight: 600,
                              border: isVoted ? 'none' : '1px solid #475569',
                              background: isVoted ? '#059669' : 'transparent',
                              color: isVoted ? '#fff' : '#cbd5e1',
                            }
                          : {
                              borderRadius: 20,
                              padding: '2px 10px',
                              fontWeight: 600,
                              border: isVoted ? 'none' : undefined,
                            }
                        }
                      >
                        <LikeOutlined /> {o.votes || 0}
                      </Tag>
                      <Button
                        type={isDark ? (isVoted ? 'primary' : 'default') : (isVoted ? 'primary' : 'default')}
                        size='small'
                        icon={isVoted ? <CheckCircleFilled /> : <LikeOutlined />}
                        disabled={phase === 'randomWindow' || submitting}
                        onClick={() => handleVote(o._id)}
                        style={{
                          borderRadius: 8,
                          fontWeight: 500,
                          ...(isDark
                            ? isVoted 
                              ? {
                                  background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 50%, #f59e0b 100%)',
                                  border: 'none',
                                  color: '#fff',
                                }
                              : {
                                  background: 'rgba(255,255,255,0.05)',
                                  borderColor: '#475569',
                                  color: '#e2e8f0',
                                }
                            : isVoted
                              ? {
                                  background: 'linear-gradient(135deg, #4285F4 0%, #34A853 50%, #FBBC04 100%)',
                                  borderColor: 'transparent',
                                }
                              : {}
                          ),
                        }}
                      >
                        {isVoted ? 'Đã vote' : 'Vote'}
                      </Button>
                    </Space>
                  </Col>
                </Row>
              </div>
            );
          })}
        </Space>
      )}
    </Card>
  );
}
