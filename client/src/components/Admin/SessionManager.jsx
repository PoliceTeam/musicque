import React, { useContext, useState } from 'react'
import { Statistic } from 'antd'
import { PlaylistContext } from '../../contexts/PlaylistContext'

// Phiên được coi là "kết thúc dự kiến" lúc 18:00 — chỉ dùng để đếm ngược cho vui
const getEndTime = () => {
  const end = new Date()
  end.setHours(18, 0, 0, 0)
  return end.getTime()
}

const SessionManager = () => {
  const { currentSession, startSession, endSession } = useContext(PlaylistContext)
  const [loading, setLoading] = useState(false)

  const run = async (action) => {
    try {
      setLoading(true)
      await action()
    } catch (error) {
      console.error('Session action failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className='sp-panel'>
      <div className='sp-panel__head'>
        <h2 className='sp-panel__title'>
          <span aria-hidden='true'>{currentSession ? '🟢' : '⚪'}</span>
          Phiên phát nhạc
        </h2>
      </div>

      <div className='sp-panel__body' style={{ padding: '0 20px 20px' }}>
        {currentSession ? (
          <>
            <p className='sp-muted' style={{ fontSize: 13, margin: '0 0 4px' }}>
              Bắt đầu lúc {new Date(currentSession.startTime).toLocaleTimeString('vi-VN')}
            </p>

            <Statistic.Timer
              title='Còn lại đến 18:00'
              value={getEndTime()}
              format='HH:mm:ss'
              type='countdown'
            />

            <button
              type='button'
              className='sp-btn sp-btn--danger'
              onClick={() => run(endSession)}
              disabled={loading}
              style={{ width: '100%', marginTop: 16 }}
            >
              Kết thúc phiên
            </button>
          </>
        ) : (
          <>
            <p className='sp-muted' style={{ fontSize: 13, margin: '0 0 16px' }}>
              Hiện không có phiên nào đang diễn ra.
            </p>
            <button
              type='button'
              className='sp-btn sp-btn--primary'
              onClick={() => run(startSession)}
              disabled={loading}
              style={{ width: '100%' }}
            >
              Mở phiên mới
            </button>
          </>
        )}
      </div>
    </section>
  )
}

export default SessionManager
