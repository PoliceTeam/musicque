import React, { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import {
  Typography,
  Card,
  Space,
  Button,
  Tag,
  message,
  Input,
  Progress,
  Row,
  Col,
  Empty,
  Tooltip,
  Badge,
} from 'antd'
import {
  CrownOutlined,
  LikeOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  EnvironmentOutlined,
  UserOutlined,
  TrophyOutlined,
  FireOutlined,
  CheckCircleFilled,
  ArrowLeftOutlined,
} from '@ant-design/icons'
import {
  addLunchOption,
  getTodayLunchOptions,
  voteLunchOption,
} from './services/api'

const { Title, Text } = Typography

function formatCountdown(target) {
  const now = new Date()
  const diff = target.getTime() - now.getTime()
  if (diff <= 0) return '00:00:00'
  const totalSeconds = Math.floor(diff / 1000)
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const s = String(totalSeconds % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function getPhaseInfo() {
  const now = new Date()
  const hour = now.getHours()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  let phase = 'beforeNoon'
  let target
  let label

  if (hour < 12) {
    phase = 'beforeNoon'
    target = new Date(today.getTime())
    target.setHours(12, 0, 0, 0)
    label = 'Còn lại để vote'
  } else if (hour >= 12 && hour < 14) {
    phase = 'randomWindow'
    target = new Date(today.getTime())
    target.setHours(14, 0, 0, 0)
    label = 'Khung giờ random'
  } else {
    phase = 'afterWindow'
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    target = new Date(tomorrow.getTime())
    target.setHours(12, 0, 0, 0)
    label = 'Vote ngày mai'
  }

  return { phase, target, label }
}

const styles = `
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  @keyframes celebrate {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.02); }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  .lunch-vote-option-card {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
  }
  .lunch-vote-option-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px rgba(102, 126, 234, 0.15) !important;
  }
  .lunch-vote-winner-card {
    animation: celebrate 2s ease-in-out infinite;
  }
  .countdown-number {
    font-variant-numeric: tabular-nums;
    background: linear-gradient(135deg, #fff 0%, #f0f0ff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .gradient-btn {
    background: #4285F4 !important;
    border: none !important;
    box-shadow: 0 4px 10px rgba(66, 133, 244, 0.35) !important;
  }
  .gradient-btn:hover {
    background: #3367D6 !important;
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(66, 133, 244, 0.45) !important;
  }
  .random-btn {
    background: #EA4335 !important;
    border: none !important;
    box-shadow: 0 4px 10px rgba(234, 67, 53, 0.35) !important;
  }
  .random-btn:hover:not(:disabled) {
    background: #C5221F !important;
    box-shadow: 0 6px 16px rgba(234, 67, 53, 0.45) !important;
  }
  .random-btn:disabled {
    opacity: 0.5;
  }
  .lunch-wheel-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.6);
    z-index: 1300;
    backdrop-filter: blur(6px);
  }
  .lunch-wheel-modal {
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    border-radius: 24px;
    padding: 28px 24px 32px;
    box-shadow: 0 25px 80px rgba(0,0,0,0.4);
    max-width: 420px;
    width: 95%;
    border: 1px solid rgba(66, 133, 244, 0.2);
  }
  .lunch-wheel-wrapper {
    position: relative;
    width: 300px;
    height: 300px;
    margin: 0 auto;
  }
  .lunch-wheel-circle {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    box-shadow: 0 8px 32px rgba(66, 133, 244, 0.3), 0 0 0 6px #fff, 0 0 0 10px #4285F4;
    overflow: hidden;
  }
  .lunch-wheel-inner {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    position: relative;
    transition: transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99);
  }
  .lunch-wheel-pointer {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 16px solid transparent;
    border-right: 16px solid transparent;
    border-top: 28px solid #EA4335;
    filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));
    z-index: 20;
  }
  .lunch-wheel-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: linear-gradient(135deg, #ffffff, #f1f5f9);
    box-shadow: 0 4px 20px rgba(0,0,0,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    z-index: 5;
    border: 5px solid #4285F4;
  }
  .lunch-wheel-segment {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%);
    transform-origin: 50% 50%;
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    padding: 20px 8px 0 0;
  }
  .lunch-wheel-segment-content {
    background: rgba(255,255,255,0.95);
    padding: 4px 8px;
    border-radius: 6px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    text-align: center;
    transform: rotate(45deg);
    max-width: 80px;
  }
  .lunch-wheel-result {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 2px solid #fbbf24;
    border-radius: 16px;
    padding: 16px 24px;
    text-align: center;
    animation: celebrate 1s ease-in-out infinite;
    margin: 12px auto 0;
    max-width: 260px;
  }
  .lunch-wheel-result-title {
    font-size: 20px;
    font-weight: 700;
    color: #92400e;
    margin-bottom: 4px;
  }
  .lunch-wheel-result-votes {
    font-size: 14px;
    color: #a16207;
  }
`

function getFoodEmoji(name) {
  const icons = ['🍜', '🍣', '🍕', '🍔', '🥗', '🌮', '🍱', '🍛', '🥟', '🍗', '🍙', '🍝']
  if (!name) return icons[0]
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return icons[hash % icons.length]
}

export default function LunchVoteApp({ username }) {
  const [dateKey, setDateKey] = useState('')
  const [options, setOptions] = useState([])
  const [newMapsUrl, setNewMapsUrl] = useState('')
  const [detectedName, setDetectedName] = useState('')
  const [manualName, setManualName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [randoming, setRandoming] = useState(false)
  const [{ phase, target, label }, setPhaseState] = useState(getPhaseInfo)
  const [countdownText, setCountdownText] = useState(formatCountdown(getPhaseInfo().target))
  const [socket, setSocket] = useState(null)
  const [showWheel, setShowWheel] = useState(false)
  const [wheelOptions, setWheelOptions] = useState([])
  const [wheelRotation, setWheelRotation] = useState(0)
  const [wheelWinner, setWheelWinner] = useState(null)

  const displayName = username || 'Guest'

  const totalVotes = useMemo(
    () => options.reduce((sum, o) => sum + (o.votes || 0), 0),
    [options],
  )

  const sortedOptions = useMemo(
    () =>
      [...options].sort((a, b) => {
        if ((b.votes || 0) !== (a.votes || 0)) {
          return (b.votes || 0) - (a.votes || 0)
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }),
    [options],
  )

  const maxVotes = sortedOptions.length ? sortedOptions[0].votes || 0 : 0

  const currentVoteOptionId = useMemo(() => {
    const todayHistory = sortedOptions.find((o) => o.voters?.includes(username))
    return todayHistory?._id || null
  }, [sortedOptions, username])

  const [winnerId, setWinnerId] = useState(null)
  const [highlightedId, setHighlightedId] = useState(null)

  const handleBackToMusic = () => {
    try {
      if (typeof window !== 'undefined' && window.location) {
        window.location.href = '/'
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    let intervalId = null

    function tick() {
      const info = getPhaseInfo()
      setPhaseState(info)
      setCountdownText(formatCountdown(info.target))
    }

    tick()
    intervalId = setInterval(tick, 1000)

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    const url = newMapsUrl.trim()
    if (!url) {
      setDetectedName('')
      return
    }
    try {
      const u = new URL(url)
      const parts = u.pathname.split('/')
      const placeIndex = parts.findIndex((p) => p === 'place')
      if (placeIndex !== -1 && parts[placeIndex + 1]) {
        const raw = decodeURIComponent(parts[placeIndex + 1])
        const name = raw.replace(/\+/g, ' ')
        setDetectedName(name)
        return
      }
      const q = u.searchParams.get('q')
      if (q) {
        setDetectedName(decodeURIComponent(q.replace(/\+/g, ' ')))
        return
      }
      setDetectedName('')
    } catch {
      setDetectedName('')
    }
  }, [newMapsUrl])

  useEffect(() => {
    async function loadAll() {
      try {
        setLoading(true)
        const todayRes = await getTodayLunchOptions()
        setDateKey(todayRes.data?.data?.dateKey || '')
        setOptions(todayRes.data?.data?.options || [])
      } catch (error) {
        console.error(error)
        message.error('Không thể tải dữ liệu Lunch Vote')
      } finally {
        setLoading(false)
      }
    }

    loadAll()
  }, [])

  // Socket.io realtime updates
  useEffect(() => {
    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (typeof window !== 'undefined' && window.__SOCKET_URL__) ||
      ''
    if (!socketUrl) {
      return
    }

    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    })
    setSocket(newSocket)

    newSocket.on('lunch_vote_updated', (payload) => {
      if (!payload) return
      if (payload.dateKey) setDateKey(payload.dateKey)
      if (Array.isArray(payload.options)) {
        setOptions(payload.options)
      }
    })

    return () => {
      newSocket.off('lunch_vote_updated')
      newSocket.disconnect()
    }
  }, [])

  const handleAddOption = async () => {
    if (!newMapsUrl.trim()) {
      message.warning('Hãy dán link Google Maps của quán ăn')
      return
    }
    try {
      setSubmitting(true)
      const finalName = detectedName || manualName.trim()
      const res = await addLunchOption(newMapsUrl.trim(), username || 'Guest', finalName || undefined)
      const option = res.data?.data
      if (option) {
        setOptions((prev) => {
          const exists = prev.find((o) => o._id === option._id)
          if (exists) return prev
          return [...prev, option]
        })
      }
      setNewMapsUrl('')
      setManualName('')
      message.success('Đã thêm quán ăn mới')
    } catch (error) {
      console.error(error)
      message.error(error.response?.data?.message || 'Không thể thêm quán ăn')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVote = async (optionId) => {
    if (phase === 'randomWindow') {
      message.info('Trong khung random 12h–14h chỉ được quay, không thể vote')
      return
    }
    try {
      setSubmitting(true)
      const res = await voteLunchOption(optionId, username || 'Guest')
      const payload = res.data?.data
      if (payload?.options) {
        setOptions(payload.options)
      }
      message.success(res.data?.message || 'Đã ghi nhận vote')
    } catch (error) {
      console.error(error)
      message.error(error.response?.data?.message || 'Không thể vote')
    } finally {
      setSubmitting(false)
    }
  }

  const winnerOption = useMemo(() => {
    if (winnerId) {
      return sortedOptions.find((o) => o._id === winnerId) || null
    }
    if (!sortedOptions.length) return null
    if (!sortedOptions[0].votes) return null
    return sortedOptions[0]
  }, [sortedOptions, winnerId])

  const handleRandom = () => {
    const eligible = sortedOptions.filter((o) => (o.votes || 0) > 0)
    if (!eligible.length) {
      message.warning('Cần ít nhất 1 quán có vote để quay')
      return
    }

    // Weighted random theo số vote
    const totalWeight = eligible.reduce((sum, o) => sum + (o.votes || 0), 0)
    let rnd = Math.random() * totalWeight
    let chosenIndex = 0
    for (let i = 0; i < eligible.length; i += 1) {
      rnd -= eligible[i].votes || 0
      if (rnd <= 0) {
        chosenIndex = i
        break
      }
    }
    const chosen = eligible[chosenIndex] || eligible[0]

    const n = eligible.length
    const segmentAngle = 360 / n
    // Góc giữa của segment được chọn (tính từ 3h, chiều kim đồng hồ)
    const targetAngle = chosenIndex * segmentAngle + segmentAngle / 2
    const spins = 5 + Math.floor(Math.random() * 3)
    // Pointer nằm cố định ở 12h, wheel quay ngược lại đúng góc giữa segment
    const finalRotation = spins * 360 - targetAngle

    // Reset wheel first, then start spinning
    setWheelOptions(eligible)
    setWheelRotation(0)
    setWheelWinner(null)
    setShowWheel(true)
    setRandoming(true)

    // Start animation after a small delay to ensure reset is applied
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setWheelRotation(finalRotation)
      })
    })

    setTimeout(() => {
      setWinnerId(chosen._id)
      setHighlightedId(chosen._id)
      setWheelWinner(chosen)
      message.success(`Hôm nay ăn: ${chosen.placeName}`)
      setRandoming(false)
    }, 4200)
  }

  const getPhaseColor = () => {
    if (phase === 'beforeNoon') return '#52c41a'
    if (phase === 'randomWindow') return '#faad14'
    return '#8c8c8c'
  }

  const getPhaseIcon = () => {
    if (phase === 'beforeNoon') return <FireOutlined />
    if (phase === 'randomWindow') return <ThunderboltOutlined />
    return <ClockCircleOutlined />
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <style>{styles}</style>

      {/* Header Section */}
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
          <Button
            type='text'
            size='small'
            icon={<ArrowLeftOutlined />}
            onClick={handleBackToMusic}
            style={{
              color: '#e5efff',
              padding: 0,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Về Music app
          </Button>
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
                Xin chào <strong style={{ color: '#fff' }}>{displayName}</strong> – Hôm nay ăn gì?
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

      <Row gutter={[20, 20]}>
        {/* Left Column - Add & Stats */}
        <Col xs={24} lg={10}>
          {/* Add Option Card */}
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

          {/* Stats Card */}
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
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#4285F4' }}>{options.length}</div>
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

          {/* Winner Card */}
          {winnerOption && (
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
          )}
        </Col>

        {/* Right Column - Restaurant List */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <EnvironmentOutlined style={{ color: '#4285F4' }} />
                <span>Danh sách quán ({sortedOptions.length})</span>
                <Tag
                  style={{
                    marginLeft: 8,
                    borderRadius: 10,
                    backgroundColor: '#4285F4',
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
              border: 'none',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            }}
            bodyStyle={{ padding: 16, maxHeight: 600, overflowY: 'auto' }}
            loading={loading}
          >
            {sortedOptions.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Text type='secondary'>
                    Chưa có quán nào. Hãy thêm quán đầu tiên!
                  </Text>
                }
              />
            ) : (
              <Space direction='vertical' style={{ width: '100%' }} size={12}>
                {sortedOptions.map((o, index) => {
                  const votePercent = totalVotes ? Math.round(((o.votes || 0) / totalVotes) * 100) : 0
                  const isVoted = currentVoteOptionId === o._id
                  const isHighlighted = highlightedId === o._id
                  const isLeading = index === 0 && o.votes > 0

                  return (
                    <div
                      key={o._id}
                      className='lunch-vote-option-card'
                      style={{
                        background: isHighlighted
                          ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
                          : isLeading
                          ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                          : '#fafafa',
                        borderRadius: 14,
                        padding: 16,
                        border: isHighlighted
                          ? '2px solid #fbbf24'
                          : isLeading
                          ? '1px solid #86efac'
                          : '1px solid #f0f0f0',
                        boxShadow: isHighlighted
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
                              backgroundColor: isLeading ? '#34A853' : '#4285F4',
                              fontWeight: 600,
                            }}
                          >
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                backgroundColor: isLeading ? '#34A853' : '#4285F4',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 22,
                                fontWeight: 700,
                              }}
                            >
                              {getFoodEmoji(o.placeName)}
                            </div>
                          </Badge>
                        </Col>
                        
                        <Col flex='1'>
                          <Space direction='vertical' size={4} style={{ width: '100%' }}>
                            <Space wrap>
                              <Text strong style={{ fontSize: 15 }}>{o.placeName}</Text>
                              {isLeading && (
                                <Tag color='gold' style={{ borderRadius: 10 }}>
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
                                  style={{ fontSize: 12, color: '#4285F4' }}
                                >
                                  <EnvironmentOutlined /> Xem địa chỉ
                                </a>
                              </Tooltip>
                              {o.createdBy && (
                                <Text type='secondary' style={{ fontSize: 12 }}>
                                  <UserOutlined /> {o.createdBy}
                                </Text>
                              )}
                            </Space>
                            
                            <Progress
                              percent={votePercent}
                              size='small'
                              strokeColor='#4285F4'
                              trailColor='#e5e7eb'
                              format={(p) => `${p}%`}
                              style={{ marginBottom: 0 }}
                            />
                          </Space>
                        </Col>
                        
                        <Col flex='none'>
                          <Space direction='vertical' align='end' size={8}>
                            <Tag
                              color={isVoted ? 'green' : 'default'}
                              style={{
                                borderRadius: 20,
                                padding: '2px 10px',
                                fontWeight: 600,
                                border: isVoted ? 'none' : undefined,
                              }}
                            >
                              <LikeOutlined /> {o.votes || 0}
                            </Tag>
                            <Button
                              type={isVoted ? 'primary' : 'default'}
                              size='small'
                              icon={isVoted ? <CheckCircleFilled /> : <LikeOutlined />}
                              disabled={phase === 'randomWindow' || submitting}
                              onClick={() => handleVote(o._id)}
                              style={{
                                borderRadius: 8,
                                fontWeight: 500,
                                ...(isVoted && {
                                  background:
                                    'linear-gradient(135deg, #4285F4 0%, #34A853 50%, #FBBC04 100%)',
                                  borderColor: 'transparent',
                                }),
                              }}
                            >
                              {isVoted ? 'Đã vote' : 'Vote'}
                            </Button>
                          </Space>
                        </Col>
                      </Row>
                    </div>
                  )
                })}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {showWheel && wheelOptions.length > 0 && (
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
                    const n = wheelOptions.length
                    const segmentAngle = 360 / n
                    const conicStops = wheelOptions
                      .map((_, i) => {
                        const start = i * segmentAngle
                        const end = (i + 1) * segmentAngle
                        const hue = (i * 360) / n
                        const color = `hsl(${hue}, 80%, 55%)`
                        return `${color} ${start}deg ${end}deg`
                      })
                      .join(', ')
                    return (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '50%',
                          background: `conic-gradient(from -90deg, ${conicStops})`,
                        }}
                      />
                    )
                  })()}
                  {wheelOptions.map((o, index) => {
                    const n = wheelOptions.length
                    const segmentAngle = 360 / n
                    const midAngle = index * segmentAngle + segmentAngle / 2 - 90
                    const radius = 100
                    const x = 150 + radius * Math.cos((midAngle * Math.PI) / 180)
                    const y = 150 + radius * Math.sin((midAngle * Math.PI) / 180)
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
                    )
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
                  Đang quay... Xác suất dựa trên số vote
                </Text>
              )}
              <Button
                type={wheelWinner ? 'primary' : 'default'}
                disabled={randoming}
                onClick={() => {
                  if (randoming) return
                  setShowWheel(false)
                  setWheelWinner(null)
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
      )}
      <div
        style={{
          marginTop: 32,
          padding: '12px 0 4px',
          textAlign: 'center',
          fontSize: 12,
          color: '#94a3b8',
        }}
      >
        Polite Lunch Vote ©2026 - Iced Tea Team -{' '}
        <span style={{ fontWeight: 600, color: '#64748b' }}>100% Made with AI</span>
      </div>
    </div>
  )
}
