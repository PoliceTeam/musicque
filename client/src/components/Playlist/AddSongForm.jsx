import React, { useState, useContext } from 'react'
import { Form, Input, message } from 'antd'
import { PlaylistContext } from '../../contexts/PlaylistContext'
import { useAuth } from '../../contexts/AuthContext'
import UserAvatar from '../Avatar/UserAvatar'

const AddSongForm = ({ variant = 'default' }) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const { addSong, currentSession } = useContext(PlaylistContext)
  const { isAuthenticated, displayName, openAuthModal, user } = useAuth()
  const isMain = variant === 'main'
  const className = `add-song-form add-song-form--${variant}`

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
      <div className={`${className} sp-empty add-song-form__empty`}>
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
      <div className={`${className} sp-empty add-song-form__empty`}>
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
    <Form
      form={form}
      layout='vertical'
      onFinish={handleSubmit}
      requiredMark={false}
      className={className}
    >
      <div className='add-song-form__identity'>
        <UserAvatar user={user} name={displayName} />
        <span>
          <span className='sp-muted'>Thêm với tên </span>
          <strong>{displayName}</strong>
        </span>
      </div>

      <div className='add-song-form__fields'>
        <Form.Item
          name='youtubeUrl'
          label='Link YouTube'
          className='add-song-form__url'
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
          extra={isMain ? null : 'Sẽ được đọc lên trước khi bài hát phát.'}
          className='add-song-form__message'
        >
          <Input.TextArea
            rows={isMain ? 1 : 3}
            autoSize={isMain ? { minRows: 1, maxRows: 2 } : undefined}
            placeholder='Gửi lời nhắn tới cả team...'
            maxLength={200}
          />
        </Form.Item>

        <button
          type='submit'
          className='sp-btn sp-btn--primary add-song-form__submit'
          disabled={loading}
        >
          {loading ? 'Đang thêm...' : 'Thêm vào hàng chờ'}
        </button>
      </div>
    </Form>
  )
}

export default AddSongForm
