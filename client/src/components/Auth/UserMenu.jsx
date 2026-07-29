import React from 'react'
import { Dropdown } from 'antd'
import { LogoutOutlined, DownOutlined } from '@ant-design/icons'
import { useAuth } from '../../contexts/AuthContext'
import { getAvatarColor, getInitials } from '../../utils/avatar'

/**
 * Góc phải thanh trên cùng: chip tài khoản khi đã đăng nhập,
 * cặp nút Đăng ký / Đăng nhập khi còn là khách.
 */
const UserMenu = () => {
  const { user, isAdmin, logout, openAuthModal, displayName, balance } = useAuth()

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
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      onClick: logout,
    },
  ]

  return (
    <>
      <span className='sp-coin' title='Polite Coins'>
        <span aria-hidden='true'>🪙</span>
        {balance}
      </span>
      <Dropdown menu={{ items }} trigger={['click']} placement='bottomRight'>
        <button type='button' className='sp-user-chip' aria-label='Menu tài khoản'>
          <span className='sp-avatar' style={{ background: getAvatarColor(displayName) }}>
            {getInitials(displayName)}
          </span>
          <span>{displayName}</span>
          {isAdmin && <span style={{ fontSize: 11, color: 'var(--sp-green)' }}>ADMIN</span>}
          <DownOutlined style={{ fontSize: 10, opacity: 0.6 }} />
        </button>
      </Dropdown>
    </>
  )
}

export default UserMenu
