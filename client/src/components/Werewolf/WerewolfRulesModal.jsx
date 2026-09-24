import React from 'react'
import { Modal } from 'antd'
import { TEAM_LABEL } from '../../utils/werewolf'

const ROLE_GROUPS = [
  { title: '🏡 Phe dân làng', teams: ['village'] },
  { title: '🐺 Phe sói', teams: ['wolf'] },
  { title: '🎭 Đơn độc, phe thứ ba & trung lập', teams: ['tanner', 'killer', 'arsonist', 'cult', 'neutral'] },
]

const seconds = (ms, fallback) => Math.round((ms || fallback) / 1000)

// Quy tắc chia vai lấy thẳng từ server (/config) nên luôn khớp với cách chia thật.
const DealingRules = ({ dealing, name }) => {
  if (!dealing) return null
  const extra = (role) => dealing.extras.find((item) => item.role === role)
  const minThirdParty = Math.min(...dealing.thirdParties.map((group) => group.minPlayers))
  return (
    <section className='ww-rules__block'>
      <h3 className='ww-rules__group'>🃏 Chia vai mỗi ván</h3>
      <ul className='ww-rules__list'>
        <li>
          <strong>Số sói:</strong> {dealing.wolves.map((tier) => `${tier.count} từ ${tier.from} người`).join(', ')}.
          Một vài con có thể là sói đặc biệt (Sói đầu đàn, Sói con, Sói đội lốt, Sói tuyết).
        </li>
        <li>
          <strong>Phe thứ ba chỉ xuất hiện khi làng đủ đông</strong> — dưới {minThirdParty} người thì ván chỉ có dân làng đấu với sói:
          <ul>
            {dealing.thirdParties.map((group) => (
              <li key={group.roles.join()}>
                {group.roles.map(name).join(' / ')}: từ <strong>{group.minPlayers} người</strong> trở lên ({group.note}).
              </li>
            ))}
          </ul>
          Có phe thứ ba thì bớt đi một con sói để hai bên vẫn cân sức. Đủ người cũng chưa chắc có — mỗi ván bốc ngẫu nhiên.
        </li>
        <li>
          <strong>Vai khác có điều kiện:</strong> {['sorcerer', 'tanner', 'thief'].map((role) => `${name(role)} từ ${extra(role)?.minPlayers} người`).join(', ')}.
          Hội kín luôn đi theo cặp, Tiên tri tập sự chỉ có khi có Tiên tri.
        </li>
        <li>Mỗi vai đặc biệt tối đa một người mỗi ván; ghế còn lại là Dân làng. Bộ vai được bốc lại cho tới khi hai phe tương đương sức mạnh.</li>
      </ul>
    </section>
  )
}

const WerewolfRulesModal = ({ open, onClose, catalog, dealing, config }) => {
  const name = (key) => {
    const role = catalog.find((item) => item.key === key)
    return role ? `${role.emoji} ${role.name}` : key
  }
  return (
    <Modal open={open} onCancel={onClose} footer={null} width={760} title='Luật chơi Ma Sói' className='ww-rules'>
      <ol className='ww-rules__flow'>
        <li>
          <strong>🌙 Đêm ({seconds(config?.nightMs, 20000)}s; đêm đầu có vai chọn người {seconds(config?.cupidNightMs, 30000)}s)</strong> — ai có kỹ năng thì chọn mục tiêu.
          Nếu ban ngày Thợ rèn đã rải bạc thì đêm đó bầy sói không ra tay; nếu Thần ngủ đã ru thì cả làng ngủ, không ai dùng được kỹ năng.
        </li>
        <li>
          <strong>☀️ Ngày ({seconds(config?.dayMs, 120000)}s)</strong> — công bố ai đã chết{config?.revealRoleOnDeath ? ' (kèm vai)' : ' (vai giữ bí mật tới hết ván)'}, cả làng thảo luận.
          Kỹ năng ban ngày: Xạ thủ bắn, Thám tử điều tra (có kết quả cuối ngày), Trưởng làng công khai, Thợ rèn rải bạc, Thần ngủ ru ngủ.
          Mọi người bấm “Sẵn sàng” thì vào bỏ phiếu sớm.
        </li>
        <li>
          <strong>🗳️ Bỏ phiếu ({seconds(config?.voteMs, 20000)}s)</strong> — người nhiều phiếu nhất bị treo cổ; phiếu của Trưởng làng đã công khai tính gấp đôi.
          Hoà phiếu hoặc “Bỏ qua” nhiều nhất thì không ai chết. Hoàng tử thoát được lần bị treo cổ đầu tiên.
        </li>
      </ol>

      <DealingRules dealing={dealing} name={name} />

      <section className='ww-rules__block'>
        <h3 className='ww-rules__group'>🏆 Ai thắng</h3>
        <ul className='ww-rules__list'>
          <li><strong>Dân làng</strong>: khi không còn sói, Kẻ sát nhân, Kẻ phóng hoả và tín đồ tà giáo nào.</li>
          <li><strong>Bầy sói</strong> (kèm Pháp sư): khi số sói bằng hoặc nhiều hơn số người còn lại.</li>
          <li><strong>Kẻ sát nhân / Kẻ phóng hoả</strong>: khi là người cuối cùng (hoặc chỉ còn mình và một người).</li>
          <li><strong>Tà giáo</strong>: khi mọi người còn sống đều theo giáo phái.</li>
          <li><strong>Kẻ chán đời</strong>: thắng một mình ngay khi bị treo cổ. <strong>Đôi tình nhân</strong>: khi chỉ còn đúng hai người yêu nhau.</li>
          <li>Kẻ trộm và Kẻ bắt chước chưa đổi vai thì không thắng được. Phe thắng nhận <strong>+{config?.winReward || 30} PC</strong> (ván có bot không tính thưởng).</li>
        </ul>
      </section>

      <section className='ww-rules__block'>
        <h3 className='ww-rules__group'>💬 Ai được nói chuyện</h3>
        <ul className='ww-rules__list'>
          <li>Ban ngày: mọi người còn sống nói chung một kênh. Người đã chết chỉ nói được ở “Nghĩa địa”.</li>
          <li>Ban đêm: dân làng phải ngủ. Bầy sói (kể cả Sói tuyết, Sói đội lốt) thì thầm ở kênh “Bầy sói”, tín đồ ở kênh “Tà giáo”. Pháp sư không nói chuyện được với bầy — bầy không biết mặt Pháp sư.</li>
          <li>Người cùng hội nhóm bí mật thấy vai của nhau: bầy sói, giáo phái, Hội kín.</li>
        </ul>
        <p className='ww-rules__note'>Đừng lộ vai ngoài đời nhé 🤫</p>
      </section>

      {ROLE_GROUPS.map((group) => {
        const roles = catalog.filter((role) => group.teams.includes(role.team))
        if (!roles.length) return null
        return (
          <section key={group.title}>
            <h3 className='ww-rules__group'>{group.title} <small>{roles.length} vai</small></h3>
            <div className='ww-rules__roles'>
              {roles.map((role) => (
                <article key={role.key} className={`ww-rules__role is-${role.team}`}>
                  <span className='ww-rules__emoji'>{role.emoji}</span>
                  <div>
                    <h4>{role.name} <small>{TEAM_LABEL[role.team] || 'Đơn độc'}</small></h4>
                    <p>{role.summary}</p>
                    {role.appears && <p className='ww-rules__appears'>🃏 {role.appears}</p>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )
      })}
      <p className='ww-rules__credit'>Luật lấy cảm hứng từ Werewolf for Telegram (GreyWolfDev).</p>
    </Modal>
  )
}

export default WerewolfRulesModal
