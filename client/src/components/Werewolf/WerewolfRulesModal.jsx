import React from 'react'
import { Modal } from 'antd'
import { TEAM_LABEL } from '../../utils/werewolf'

const WerewolfRulesModal = ({ open, onClose, catalog, config }) => (
  <Modal open={open} onCancel={onClose} footer={null} width={720} title='Luật chơi Ma Sói' className='ww-rules'>
    <ol className='ww-rules__flow'>
      <li><strong>🌙 Đêm ({Math.round((config?.nightMs || 20000) / 1000)}s; đêm đầu có Thần tình yêu {Math.round((config?.cupidNightMs || 30000) / 1000)}s)</strong> — ai có kỹ năng thì chọn mục tiêu. Bầy sói bàn nhau trong kênh riêng và chọn người để ăn thịt.</li>
      <li><strong>☀️ Ngày ({Math.round((config?.dayMs || 120000) / 1000)}s)</strong> — công bố ai đã chết (kèm vai), cả làng thảo luận. Mọi người bấm “Sẵn sàng” thì vào bỏ phiếu sớm.</li>
      <li><strong>🗳️ Bỏ phiếu ({Math.round((config?.voteMs || 20000) / 1000)}s)</strong> — người nhiều phiếu nhất bị treo cổ. Hoà phiếu hoặc “Bỏ qua” nhiều nhất thì không ai chết.</li>
      <li><strong>🏆 Thắng</strong> — dân làng thắng khi hết sói (và sát nhân); sói thắng khi đông bằng số người còn lại. Phe thắng nhận <strong>+{config?.winReward || 30} PC</strong> (ván có bot không tính thưởng).</li>
    </ol>
    <p className='ww-rules__note'>Người đã chết chỉ trò chuyện được ở “Nghĩa địa”. Ban đêm dân làng không được nói. Đừng lộ vai ngoài đời nhé 🤫</p>
    <div className='ww-rules__roles'>
      {catalog.map((role) => (
        <article key={role.key} className={`ww-rules__role is-${role.team}`}>
          <span className='ww-rules__emoji'>{role.emoji}</span>
          <div>
            <h4>{role.name} <small>{TEAM_LABEL[role.team]}</small></h4>
            <p>{role.summary}</p>
          </div>
        </article>
      ))}
    </div>
    <p className='ww-rules__credit'>Luật lấy cảm hứng từ Werewolf for Telegram (GreyWolfDev).</p>
  </Modal>
)

export default WerewolfRulesModal
