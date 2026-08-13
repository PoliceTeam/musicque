import React, { useEffect, useState } from 'react'
import { Button, Dropdown, Modal } from 'antd'
import { LogoutOutlined, DownOutlined, PictureOutlined } from '@ant-design/icons'
import { useAuth } from '../../contexts/AuthContext'
import UserAvatar from '../Avatar/UserAvatar'
import { ANIMAL_AVATARS } from '../../constants/animalAvatars'

/**
 * Góc phải thanh trên cùng: chip tài khoản khi đã đăng nhập,
 * cặp nút Đăng ký / Đăng nhập khi còn là khách.
 */
const UserMenu = () => {
  const { user, isAdmin, logout, openAuthModal, displayName, balance, updateAvatar } = useAuth()
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatarId || 'cat')
  const [savingAvatar, setSavingAvatar] = useState(false)

  useEffect(() => {
    if (user?.avatarId) setSelectedAvatar(user.avatarId)
  }, [user?.avatarId])

  if (!user) {
    return (
      <>
        <button
          type='button'
          className='sp-btn sp-btn--ghost sp-btn--sm'
          onClick={() => openAuthModal('register')}
        >
          Đăng ký
        </button>
        <button
          type='button'
          className='sp-btn sp-btn--primary sp-btn--sm'
          onClick={() => openAuthModal('login')}
        >
          Đăng nhập
        </button>
      </>
    )
  }

  // "Bảng điều khiển" nằm ở SidebarNav — không lặp lại ở đây
  const items = [
    {
      key: 'avatar',
      icon: <PictureOutlined />,
      label: 'Đổi avatar',
      onClick: () => setAvatarOpen(true),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      onClick: logout,
    },
  ]

  const handleSaveAvatar = async () => {
    setSavingAvatar(true)
    const result = await updateAvatar(selectedAvatar)
    setSavingAvatar(false)

    if (result.ok) setAvatarOpen(false)
  }

  return (
    <>
      <span className='sp-coin' title='Polite Coins'>
        <img className='sp-coin__img' src='/dice/coin.png' alt='' draggable={false} />
        {balance}
        <span className='sp-coin__unit'>PC</span>
      </span>
      <Dropdown menu={{ items }} trigger={['click']} placement='bottomRight'>
        <button type='button' className='sp-user-chip' aria-label='Menu tài khoản'>
          <UserAvatar user={user} name={displayName} />
          <span>{displayName}</span>
          {isAdmin && <span style={{ fontSize: 11, color: 'var(--sp-green)' }}>ADMIN</span>}
          <DownOutlined style={{ fontSize: 10, opacity: 0.6 }} />
        </button>
      </Dropdown>

      <Modal
        open={avatarOpen}
        title='Chọn avatar'
        onCancel={() => setAvatarOpen(false)}
        footer={[
          <Button key='cancel' onClick={() => setAvatarOpen(false)}>
            Hủy
          </Button>,
          <Button key='save' type='primary' loading={savingAvatar} onClick={handleSaveAvatar}>
            Lưu avatar
          </Button>,
        ]}
        width={680}
        centered
      >
        <div className='avatar-picker'>
          {ANIMAL_AVATARS.map((avatar) => (
            <button
              key={avatar.id}
              type='button'
              className={`avatar-picker__item${selectedAvatar === avatar.id ? ' is-selected' : ''}`}
              onClick={() => setSelectedAvatar(avatar.id)}
              aria-label={`Chọn avatar ${avatar.label}`}
            >
              <UserAvatar avatarId={avatar.id} name={avatar.label} size={56} />
              <span>{avatar.label}</span>
            </button>
          ))}
        </div>
      </Modal>
    </>
  )
}

export default UserMenu
