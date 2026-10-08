import React from 'react'
import { PIECES, PIECE_GUIDE, SIDE_LABEL, pieceSituation, predatorsOf, preyOf } from '../../utils/jungle'
import { iconUrl } from './jungleAssets'

const Chips = ({ types, empty }) => (
  <span className='jg-pcard__chips'>
    {types.length === 0 && <em>{empty}</em>}
    {types.map((type) => (
      <span key={type} className={`jg-pcard__chip is-${type}`} title={PIECES[type].name}>
        <img src={iconUrl(type)} alt='' />
        {PIECES[type].name}
      </span>
    ))}
  </span>
)

// Thẻ giải thích quân vừa bấm: là con gì, cấp mấy, ăn được ai, bị ai ăn, năng lực, tình trạng hiện tại.
const JunglePieceCard = ({ piece, mySide, moveCount, onClose }) => {
  if (!piece) return null
  const meta = PIECES[piece.type]
  const guide = PIECE_GUIDE[piece.type]
  const situation = pieceSituation(piece)
  const owner = !mySide ? `Phe ${SIDE_LABEL[piece.side]}` : piece.side === mySide ? 'Quân của bạn' : 'Quân đối thủ'

  return (
    <aside className={`jg-pcard is-${piece.side}`} aria-label={`Thông tin quân ${meta.name}`}>
      <button type='button' className='jg-pcard__close' onClick={onClose} aria-label='Đóng thẻ quân'>×</button>
      <header className='jg-pcard__head'>
        <span className={`jg-pcard__icon is-${piece.type}`}><img src={iconUrl(piece.type)} alt='' /></span>
        <div>
          <span className='jg-pcard__owner'>{owner} · ô {piece.square}</span>
          <h3>{meta.name}</h3>
          <p>{guide.role}</p>
        </div>
        <span className={`jg-pcard__rank${piece.weakened ? ' is-weak' : ''}`} title='Cấp hiện tại'>
          <small>CẤP</small>
          {piece.weakened ? <><s>{meta.rank}</s>0</> : meta.rank}
        </span>
      </header>

      {situation && <p className={`jg-pcard__situation is-${situation.tone}`}>{situation.text}</p>}

      <dl className='jg-pcard__facts'>
        <dt>Ăn được</dt>
        <dd><Chips types={preyOf(piece.type)} empty='—' /></dd>
        <dt>Bị ăn bởi</dt>
        <dd><Chips types={predatorsOf(piece.type)} empty='—' /></dd>
      </dl>

      <ul className='jg-pcard__abilities'>
        {guide.abilities.map((text) => <li key={text}>{text}</li>)}
        <li className='is-general'>Bước vào hang quanh ổ địch thì mất hết sức mạnh (cấp 0).</li>
      </ul>

      {moveCount !== null && (
        <p className='jg-pcard__moves'>
          {moveCount > 0 ? `Có ${moveCount} nước đi được — các ô sáng trên bàn.` : 'Lúc này quân này không đi được nước nào.'}
        </p>
      )}
    </aside>
  )
}

export default JunglePieceCard
