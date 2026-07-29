import React, { useState, useContext } from 'react'
import { Form, Input, message } from 'antd'
import { PlaylistContext } from '../../contexts/PlaylistContext'
import { useAuth } from '../../contexts/AuthContext'
import { getAvatarColor, getInitials } from '../../utils/avatar'

const AddSongForm = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const { addSong, currentSession } = useContext(PlaylistContext)
  const { isAuthenticated, displayName, openAuthModal } = useAuth()

  const handleSubmit = async (values) => {
    if (!currentSession) {
      message.error('Không có phiên phát nhạc nào đang diễn ra')
      return
    }

    try {
      setLoading(true)
      const success = await addSong(values.youtubeUrl, values.message)
      if (success) {
        form.resetFields()
      }
    } catch (error) {
      console.error('Error adding song:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!currentSession) {
    return (
      <div className='sp-empty'>
        <span className='sp-empty__icon' aria-hidden='true'>
          🌙
        </span>
        <strong>Chưa có phiên nào</strong>
        <span>Chờ admin mở phiên phát nhạc để bắt đầu xếp hàng.</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className='sp-empty'>
        <span className='sp-empty__icon' aria-hidden='true'>
          🔒
        </span>
        <strong>Cần tài khoản để thêm bài</strong>
        <span style={{ marginBottom: 8 }}>
          Mỗi người một tài khoản, một phiếu vote — playlist sạch hơn hẳn.
        </span>
        <button
          type='button'
          className='sp-btn sp-btn--primary sp-btn--sm'
          onClick={() => openAuthModal('login', 'Đăng nhập để thêm bài hát vào phiên phát nhạc.')}
        >
          Đăng nhập
        </button>
      </div>
    )
  }

  return (
    <Form form={form} layout='vertical' onFinish={handleSubmit} requiredMark={false}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
          fontSize: 13,
        }}
      >
        <span className='sp-avatar' style={{ background: getAvatarColor(displayName) }}>
          {getInitials(displayName)}
        </span>
        <span>
          <span className='sp-muted'>Thêm với tên </span>
          <strong>{displayName}</strong>
        </span>
      </div>

      <Form.Item
        name='youtubeUrl'
        label='Link YouTube'
        rules={[
          { required: true, message: 'Vui lòng nhập link YouTube' },
          {
            pattern: /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/,
            message: 'Vui lòng nhập link YouTube hợp lệ',
          },
        ]}
      >
        <Input placeholder='https://www.youtube.com/watch?v=...' />
      </Form.Item>

      <Form.Item
        name='message'
        label='Lời nhắn'
        extra='Sẽ được đọc lên trước khi bài hát phát.'
        style={{ marginBottom: 18 }}
      >
        <Input.TextArea rows={3} placeholder='Gửi lời nhắn tới cả team...' maxLength={200} />
      </Form.Item>

      <button
        type='submit'
        className='sp-btn sp-btn--primary'
        disabled={loading}
        style={{ width: '100%' }}
      >
        {loading ? 'Đang thêm...' : 'Thêm vào hàng chờ'}
      </button>
    </Form>
  )
}

export default AddSongForm
