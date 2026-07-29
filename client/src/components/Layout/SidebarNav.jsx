import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { HomeFilled, DashboardOutlined } from '@ant-design/icons'
import { useAuth } from '../../contexts/AuthContext'

/**
 * Khối thương hiệu + điều hướng ở đầu sidebar, dùng chung cho trang chủ và
 * trang admin. Trang chủ và Bảng điều khiển luôn nằm cùng một section để admin
 * nhảy qua lại bằng một cú bấm ở bất kỳ trang nào.
 *
 * children: nội dung phụ chèn xuống dưới menu (hàng icon easter egg ở trang chủ).
 */
const SidebarNav = ({ subtitle = 'Iced Tea Team', children }) => {
  const { isAdmin } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const itemClass = (path) =>
    `sp-nav__item${pathname === path ? ' sp-nav__item--active' : ''}`

  return (
    <nav className='sp-panel'>
      <button type='button' className='sp-brand' onClick={() => navigate('/')}>
        <span className='sp-brand__mark' aria-hidden='true'>
          ♪
        </span>
        <span>
          <span className='sp-brand__name'>Musicque</span>
          <br />
          <span className='sp-brand__sub'>{subtitle}</span>
        </span>
      </button>

      <div className='sp-nav'>
        <button type='button' className={itemClass('/')} onClick={() => navigate('/')}>
          <HomeFilled className='sp-nav__icon' />
          Trang chủ
        </button>

        {isAdmin && (
          <button type='button' className={itemClass('/admin')} onClick={() => navigate('/admin')}>
            <DashboardOutlined className='sp-nav__icon' />
            Bảng điều khiển
          </button>
        )}

        {/* Tạm tắt lối vào Lunch Vote và PoliBoard — route /lunch-vote và
            /poliboard vẫn còn, mở lại bằng cách bỏ comment khối này. */}
        {/*
        <button type='button' className={itemClass('/lunch-vote')} onClick={() => navigate('/lunch-vote')}>
          <CoffeeOutlined className='sp-nav__icon' />
          Lunch Vote
        </button>
        <button type='button' className={itemClass('/poliboard')} onClick={() => navigate('/poliboard')}>
          <HighlightOutlined className='sp-nav__icon' />
          PoliBoard
        </button>
        */}
      </div>

      {children}
    </nav>
  )
}

export default SidebarNav
