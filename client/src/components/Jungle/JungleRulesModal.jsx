import React from 'react'
import { Modal } from 'antd'
import { PIECES, PIECE_ORDER } from '../../utils/jungle'
import { iconUrl } from './jungleAssets'

const JungleRulesModal = ({ open, onClose, config }) => (
  <Modal open={open} onCancel={onClose} footer={null} width={640} title='Luật Cờ thú' className='jg-rules'>
    <section>
      <h4>Mục tiêu</h4>
      <p>Đưa một quân bất kỳ vào <b>Ổ thú</b> của đối phương, hoặc ăn sạch 8 quân của họ.</p>
    </section>
    <section>
      <h4>Quân cờ — cấp lớn hơn hoặc bằng thì ăn được</h4>
      <div className='jg-rules__pieces'>
        {[...PIECE_ORDER].reverse().map((type) => (
          <span key={type} className={`jg-rules__piece is-${type}`}>
            <img src={iconUrl(type)} alt='' />
            <b>{PIECES[type].rank}</b> {PIECES[type].name}
          </span>
        ))}
      </div>
    </section>
    <section>
      <h4>Di chuyển</h4>
      <ul>
        <li>Mỗi lượt đi 1 quân, 1 ô theo chiều ngang hoặc dọc, không đi chéo.</li>
        <li>Không quân nào được bước vào ổ của phe mình.</li>
      </ul>
    </section>
    <section>
      <h4>Năng lực đặc biệt</h4>
      <ul>
        <li><b>Chuột</b> là quân duy nhất xuống được sông. Chuột ăn được Voi khi cả hai ở trên cạn; <b>Voi không ăn được Chuột</b>.</li>
        <li>Quân dưới nước và quân trên bờ không ăn được nhau — kể cả Chuột với Chuột.</li>
        <li><b>Sư tử</b> và <b>Hổ</b> nhảy qua sông theo cả chiều dọc lẫn ngang, ăn luôn quân ở ô đáp nếu cấp nhỏ hơn hoặc bằng. Có Chuột (bất kỳ phe nào) dưới nước chắn đường thì không nhảy được. Báo không nhảy.</li>
      </ul>
    </section>
    <section>
      <h4>Ô hang (bẫy)</h4>
      <ul>
        <li>Quân địch bước vào hang quanh ổ của bạn bị mất hết sức mạnh (cấp 0): quân nào của bạn cũng ăn được, kể cả Voi ăn Chuột.</li>
        <li>Quân đang trong hang địch không ăn được ai; chỉ có thể đi ra ô trống hoặc vào thẳng ổ.</li>
      </ul>
    </section>
    <section>
      <h4>Hòa và thua</h4>
      <ul>
        <li>Hòa khi: hai bên đồng ý · cùng một thế cờ lặp lại 3 lần · mỗi bên chỉ còn 1 Chuột · 50 lượt mỗi bên không ăn quân.</li>
        <li>Đến lượt mà không còn nước hợp lệ nào thì thua.</li>
        {config && (
          <li>
            Đấu người: mỗi bên cược <b>{config.stake} PC</b>, thắng nhận {config.stake * 2} PC, hòa hoàn cược.
            Mỗi bên có {Math.round(config.clockMs / 60000)} phút; rời ván quá {Math.round(config.disconnectMs / 60000)} phút là thua.
          </li>
        )}
      </ul>
    </section>
  </Modal>
)

export default JungleRulesModal
