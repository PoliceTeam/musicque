import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Modal,
  Segmented,
  Spin,
  Tooltip,
} from 'antd'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BarChartOutlined,
  CrownOutlined,
  GiftOutlined,
  ReloadOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import { getCoinEconomyStats } from '../../services/api'
import './coin-economy.css'

const PERIOD_OPTIONS = [
  { label: '7 ngày', value: '7d' },
  { label: '30 ngày', value: '30d' },
  { label: 'Toàn bộ', value: 'all' },
]

const formatNumber = (value) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value) || 0)

const formatDate = (value) => {
  if (!value) return 'Từ phiên bản này'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const Metric = ({ icon, label, value, tone = 'neutral', note }) => (
  <div className={`coin-economy__metric coin-economy__metric--${tone}`}>
    <span className='coin-economy__metric-icon'>{icon}</span>
    <div>
      <span className='coin-economy__metric-label'>{label}</span>
      <strong>{formatNumber(value)} <small>PC</small></strong>
      {note && <span className='coin-economy__metric-note'>{note}</span>}
    </div>
  </div>
)

const CoinEconomyModal = ({ open, onClose }) => {
  const [period, setPeriod] = useState('30d')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadStats = useCallback(async (signal) => {
    setLoading(true)
    setError('')
    try {
      const { data } = await getCoinEconomyStats(period, { signal })
      setStats(data)
    } catch (requestError) {
      if (requestError.name === 'CanceledError' || requestError.code === 'ERR_CANCELED') return
      setError(requestError.response?.data?.message || 'Không tải được thống kê Polite Coins')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [period])

  useEffect(() => {
    if (!open) return undefined
    const controller = new AbortController()
    loadStats(controller.signal)
    return () => controller.abort()
  }, [open, loadStats])

  const houseNet = stats?.totals?.houseNet || 0
  const houseTone = houseNet > 0 ? 'positive' : houseNet < 0 ? 'negative' : 'neutral'
  const houseLabel = houseNet >= 0 ? 'Nhà cái thu ròng' : 'Nhà cái chi ròng'
  const houseValue = Math.abs(houseNet)

  const summary = useMemo(() => {
    if (!stats) return ''
    const { transactionCount = 0, activeUserCount = 0 } = stats.totals || {}
    return `${formatNumber(transactionCount)} giao dịch · ${formatNumber(activeUserCount)} user hoạt động`
  }, [stats])

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      centered
      destroyOnHidden={false}
      className='coin-economy-modal'
      title={null}
    >
      <header className='coin-economy__header'>
        <div className='coin-economy__title'>
          <span className='coin-economy__title-icon'><BarChartOutlined /></span>
          <div>
            <span className='coin-economy__eyebrow'>Kho bạc Musicque</span>
            <h2>Dòng chảy Polite Coins</h2>
            <p>{summary || 'Theo dõi sức khỏe nền kinh tế nội bộ'}</p>
          </div>
        </div>
        <div className='coin-economy__controls'>
          <Segmented
            options={PERIOD_OPTIONS}
            value={period}
            onChange={setPeriod}
            aria-label='Khoảng thời gian thống kê'
          />
          <Tooltip title='Tải lại số liệu'>
            <button
              type='button'
              className='sp-btn sp-btn--ghost sp-btn--icon'
              onClick={() => loadStats()}
              disabled={loading}
              aria-label='Tải lại thống kê'
            >
              <ReloadOutlined spin={loading} />
            </button>
          </Tooltip>
        </div>
      </header>

      {error && <Alert type='error' showIcon message={error} className='coin-economy__alert' />}

      <Spin spinning={loading && !stats}>
        {stats && (
          <div className='coin-economy__content'>
            <section className='coin-economy__hero-metrics' aria-label='Tổng quan Polite Coins'>
              <Metric
                icon={<SafetyCertificateOutlined />}
                label='Đang lưu hành'
                value={stats.circulation.currentSupply}
                tone='supply'
                note={`${formatNumber(stats.circulation.userCount)} ví người dùng`}
              />
              <Metric
                icon={houseNet >= 0 ? <ArrowDownOutlined /> : <ArrowUpOutlined />}
                label={houseLabel}
                value={houseValue}
                tone={houseTone}
                note='Bid + cược − trả thưởng'
              />
              <Metric
                icon={<GiftOutlined />}
                label='Đã phát hành'
                value={stats.totals.issued}
                tone='issued'
                note='Vốn đăng ký + thưởng ngày'
              />
            </section>

            <section className='coin-economy__flows' aria-label='Chi tiết dòng tiền'>
              <div className='coin-economy__flow-head'>
                <div>
                  <span>Hoạt động kinh tế</span>
                  <strong>Tiền đi đâu, về đâu</strong>
                </div>
                <span className='coin-economy__tracking'>
                  Ghi nhận từ {formatDate(stats.trackingSince)}
                </span>
              </div>
              <div className='coin-economy__flow-grid'>
                <Metric
                  icon={<RocketOutlined />}
                  label='Đã dùng bid nhạc'
                  value={stats.totals.songBidConsumed}
                  tone='spent'
                />
                <Metric
                  icon={<CrownOutlined />}
                  label='Đã đặt cược'
                  value={stats.totals.chohanWagered}
                  tone='wager'
                />
                <Metric
                  icon={<ArrowUpOutlined />}
                  label='Nhà cái trả thưởng'
                  value={stats.totals.chohanPayout}
                  tone='payout'
                />
                <Metric
                  icon={<SwapOutlined />}
                  label='Đã hoàn lại'
                  value={stats.totals.refunded}
                  tone='refund'
                />
              </div>
            </section>

            <section className='coin-economy__users' aria-label='User hoạt động nhiều nhất'>
              <div className='coin-economy__section-title'>
                <div>
                  <span>Top 5</span>
                  <strong>Ví hoạt động mạnh nhất</strong>
                </div>
                <span>Tổng lượng PC vào + ra</span>
              </div>

              {stats.topUsers.length === 0 ? (
                <div className='coin-economy__empty'>
                  Chưa có giao dịch nào trong khoảng thời gian này.
                </div>
              ) : (
                <div className='coin-economy__user-list'>
                  {stats.topUsers.map((user, index) => (
                    <div className='coin-economy__user-row' key={user.userId}>
                      <span className='coin-economy__rank'>{index + 1}</span>
                      <div className='coin-economy__identity'>
                        <strong>{user.displayName || user.username}</strong>
                        <span>@{user.username} · {formatNumber(user.transactionCount)} giao dịch</span>
                      </div>
                      <div className='coin-economy__user-flow coin-economy__user-flow--in'>
                        <span>Nhận</span>
                        <strong>+{formatNumber(user.received)}</strong>
                      </div>
                      <div className='coin-economy__user-flow coin-economy__user-flow--out'>
                        <span>Chi</span>
                        <strong>-{formatNumber(user.spent)}</strong>
                      </div>
                      <div className={`coin-economy__net ${user.net >= 0 ? 'is-positive' : 'is-negative'}`}>
                        {user.net >= 0 ? '+' : ''}{formatNumber(user.net)} PC
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </Spin>
    </Modal>
  )
}

export default CoinEconomyModal
