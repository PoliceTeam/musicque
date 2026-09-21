import React from 'react'
import { Button, Modal } from 'antd'
import { CrownOutlined, ThunderboltOutlined } from '@ant-design/icons'
import './core.css'

const CoreLaunchPopup = ({ open, onClose, onExplore }) => (
  <Modal
    open={open}
    onCancel={onClose}
    footer={null}
    width={880}
    centered
    className='core-launch-modal'
    destroyOnClose
  >
    <section className='core-launch'>
      <div className='core-launch__aurora' aria-hidden='true'>
        <i /><i /><i /><i />
      </div>

      <div className='core-launch__content'>
        <div className='core-launch__mark' aria-hidden='true'>
          <span><CrownOutlined /></span>
        </div>
        <p className='core-launch__eyebrow'>MUSICQUE CORE · MEMBERS ONLY</p>
        <h2>Bài hát của bạn.<br /><em>Lên sân khấu trước.</em></h2>
        <p className='core-launch__lead'>
          Nâng cấp danh tính với khung avatar phát sáng, tên nổi bật trong chat và
          đặc quyền boost playlist dành riêng cho Core.
        </p>

        <div className='core-launch__benefits'>
          <article>
            <strong><ThunderboltOutlined /> +5</strong>
            <span>Tự động boost 3 bài đầu mỗi phiên</span>
          </article>
          <article>
            <strong>4 sắc</strong>
            <span>Hiệu ứng độc quyền màu Politetech</span>
          </article>
          <article>
            <strong>+30 PC</strong>
            <span>Quà chào mừng ngay khi kích hoạt</span>
          </article>
        </div>

        <div className='core-launch__action'>
          <div><strong>250 PC</strong><span>/ 7 ngày</span></div>
          <Button type='primary' size='large' onClick={onExplore}>
            Khám phá Core <span aria-hidden='true'>→</span>
          </Button>
        </div>
        <button type='button' className='core-launch__later' onClick={onClose}>Để sau</button>
      </div>
    </section>
  </Modal>
)

export default CoreLaunchPopup
