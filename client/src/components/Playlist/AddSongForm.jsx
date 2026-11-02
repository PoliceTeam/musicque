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
  // inline: một dòng duy nhất gắn trên đầu khung Hàng chờ ở trang chủ
  const isInline = variant === 'inline'
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

  if (isInline && (!currentSession || !isAuthenticated)) {
    return (
      <div className={`${className} add-song-form__notice`}>
        <span aria-hidden='true'>{currentSession ? '🔒' : '🌙'}</span>
        <span>
          {currentSession
            ? 'Đăng nhập để thêm bài vào hàng chờ.'
            : <><strong>Chưa có phiên nào</strong> · chờ admin mở phiên phát nhạc để xếp hàng.</>}
        </span>
        {currentSession && (
          <button
            type='button'
            className='sp-btn sp-btn--primary sp-btn--sm'
            onClick={() => openAuthModal('login', 'Đăng nhập để thêm bài hát vào phiên phát nhạc.')}
          >
            Đăng nhập
          </button>
        )}
      </div>
    )
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
      {isInline ? (
        <span className='add-song-form__avatar' title={`Thêm với tên ${displayName}`}>
          <UserAvatar user={user} name={displayName} />
        </span>
      ) : (
      <div className='add-song-form__identity'>
        <UserAvatar user={user} name={displayName} />
        <span>
          <span className='sp-muted'>Thêm với tên </span>
          <strong>{displayName}</strong>
        </span>
      </div>
      )}

      <div className='add-song-form__fields'>
        <Form.Item
          name='youtubeUrl'
          label={isInline ? undefined : 'Link YouTube'}
          className='add-song-form__url'
          rules={[
            { required: true, message: 'Vui lòng nhập link YouTube' },
            {
              pattern: /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/,
              message: 'Vui lòng nhập link YouTube hợp lệ',
            },
          ]}
        >
          <Input
            placeholder={isInline ? 'Dán link YouTube…' : 'https://www.youtube.com/watch?v=...'}
            aria-label='Link YouTube'
          />
        </Form.Item>

        <Form.Item
          name='message'
          label={isInline ? undefined : 'Lời nhắn'}
          extra={isMain || isInline ? null : 'Sẽ được đọc lên trước khi bài hát phát.'}
          className='add-song-form__message'
        >
          <Input.TextArea
            rows={isMain || isInline ? 1 : 3}
            autoSize={isMain || isInline ? { minRows: 1, maxRows: 2 } : undefined}
            placeholder={isInline ? 'Lời nhắn (tuỳ chọn)…' : 'Gửi lời nhắn tới cả team...'}
            aria-label='Lời nhắn'
            maxLength={200}
          />
        </Form.Item>

        <button
          type='submit'
          className='sp-btn sp-btn--primary add-song-form__submit'
          disabled={loading}
        >
          {loading ? 'Đang thêm...' : isInline ? '➕ Thêm bài' : 'Thêm vào hàng chờ'}
        </button>
      </div>
    </Form>
  )
}

export default AddSongForm
