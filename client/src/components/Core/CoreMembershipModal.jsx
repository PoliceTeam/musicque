import React, { useEffect, useMemo, useState } from 'react'
import { Button, Modal, Switch, message } from 'antd'
import { CrownOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useAuth } from '../../contexts/AuthContext'
import UserAvatar from '../Avatar/UserAvatar'
import CoreName from './CoreName'
import { CORE_PRESETS, isCoreActive } from './coreIdentity'
import './core.css'

const formatExpiry = (value) =>
  value
    ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : ''

const CoreMembershipModal = ({ open, onClose }) => {
  const { user, balance, purchaseCore, updateCorePreferences } = useAuth()
  const [style, setStyle] = useState(user?.core?.style || 'polite-blue')
  const [motionEnabled, setMotionEnabled] = useState(user?.core?.motionEnabled !== false)
  const [intensity, setIntensity] = useState(user?.core?.intensity || 'subtle')
  const [saving, setSaving] = useState(false)
  const [buying, setBuying] = useState(false)
  const active = isCoreActive(user?.core)

  useEffect(() => {
    setStyle(user?.core?.style || 'polite-blue')
    setMotionEnabled(user?.core?.motionEnabled !== false)
    setIntensity(user?.core?.intensity || 'subtle')
  }, [user?.core])

  const previewUser = useMemo(
    () => ({
      ...user,
      core: { ...user?.core, active: true, expiresAt: user?.core?.expiresAt || new Date(Date.now() + 864e5), style, motionEnabled, intensity },
    }),
    [user, style, motionEnabled, intensity],
  )

  const buy = async () => {
    setBuying(true)
    const result = await purchaseCore()
    if (result.ok) {
      const preferenceResult = await updateCorePreferences({ style, motionEnabled, intensity })
      if (!preferenceResult.ok) message.warning(preferenceResult.error)
    }
    setBuying(false)
    if (!result.ok) message.error(result.error)
  }

  const save = async () => {
    setSaving(true)
    const result = await updateCorePreferences({ style, motionEnabled, intensity })
    setSaving(false)
    if (!result.ok) message.error(result.error)
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={720} centered className='core-modal'>
      <div className='core-hero'>
        <span className='core-hero__orb'><CrownOutlined /></span>
        <div>
          <span className='core-hero__eyebrow'>MUSICQUE CORE</span>
          <h2>Đưa danh tính của bạn lên sân khấu</h2>
          <p>Khung avatar, tên phát sáng trong chat và Core Boost cho bài hát bạn chọn.</p>
        </div>
      </div>

      <div className='core-preview'>
        <UserAvatar user={previewUser} name={previewUser?.displayName} size={48} />
        <div className='core-preview__bubble'>
          <CoreName user={previewUser} name={previewUser?.displayName || previewUser?.username} />
          <p>Bài này phải lên playlist ngay thôi ✨</p>
        </div>
      </div>

      <div className='core-preset-grid' role='radiogroup' aria-label='Phong cách Core'>
        {CORE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type='button'
            role='radio'
            aria-checked={style === preset.id}
            className={`core-preset core-preset--${preset.id}${style === preset.id ? ' is-selected' : ''}`}
            onClick={() => setStyle(preset.id)}
          >
            <span className='core-preset__gem' />
            <strong>{preset.name}</strong>
            <small>{preset.description}</small>
          </button>
        ))}
      </div>

      <div className='core-controls'>
        <label><span>Chuyển động</span><Switch checked={motionEnabled} onChange={setMotionEnabled} /></label>
        <div className='core-intensity' aria-label='Cường độ hiệu ứng'>
          <button type='button' className={intensity === 'subtle' ? 'is-active' : ''} onClick={() => setIntensity('subtle')}>Tinh tế</button>
          <button type='button' className={intensity === 'vivid' ? 'is-active' : ''} onClick={() => setIntensity('vivid')}>Nổi bật</button>
        </div>
      </div>

      <div className='core-benefits'>
        <span><ThunderboltOutlined /> +5 điểm cho 3 bài đầu mỗi phiên</span>
        <span>30 PC chào mừng</span>
        <span>4 phong cách màu Politetech</span>
      </div>

      {active ? (
        <div className='core-action'>
          <div><strong>Core đang hoạt động</strong><small>Đến {formatExpiry(user.core.expiresAt)}</small></div>
          <Button type='primary' loading={saving} onClick={save}>Lưu phong cách</Button>
        </div>
      ) : (
        <div className='core-action'>
          <div><strong>250 PC / 7 ngày</strong><small>Bạn đang có {balance} PC · nhận lại 30 PC</small></div>
          <Button type='primary' loading={buying} disabled={balance < 250} onClick={buy}>Kích hoạt Core</Button>
        </div>
      )}
    </Modal>
  )
}

export default CoreMembershipModal
