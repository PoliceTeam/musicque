import React, { useMemo, useState } from 'react'

const ASSET_ROOT = '/xiangqi/gmchess-wood'
const PIECE_NAMES = { a: 'advisor', b: 'bishop', c: 'cannon', k: 'king', n: 'knight', p: 'pawn', r: 'rook' }
const FILES = 'abcdefghi'

const squareFor = (row, col) => `${FILES[col]}${9 - row}`

const XiangqiBoard = ({ game, disabled, hint, answer, onMove }) => {
  const [selected, setSelected] = useState(null)
  const legalTargets = useMemo(() => new Set(
    game.legalMoves.filter((move) => move.from === selected).map((move) => move.to),
  ), [game.legalMoves, selected])

  const clickSquare = (row, col) => {
    if (disabled) return
    const square = squareFor(row, col)
    const piece = game.board[row][col]
    if (selected && legalTargets.has(square)) {
      const from = selected
      setSelected(null)
      onMove(from, square)
      return
    }
    setSelected(piece?.color === 'r' ? square : null)
  }

  return (
    <div className={`xiangqi-board${disabled ? ' is-disabled' : ''}`} aria-label='Bàn cờ tướng'>
      <img className='xiangqi-board__wood' src={`${ASSET_ROOT}/xiangqi_gmchess_wood.svg`} alt='' draggable='false' />
      {game.board.flatMap((row, rowIndex) => row.map((piece, colIndex) => {
        const square = squareFor(rowIndex, colIndex)
        const isTarget = legalTargets.has(square)
        const isHint = hint?.from === square || answer?.from === square
        const isAnswer = answer?.to === square
        if (!piece && !isTarget && !isAnswer) return null
        return (
          <button
            type='button'
            key={square}
            aria-label={piece ? `${piece.color === 'r' ? 'Đỏ' : 'Đen'} ${PIECE_NAMES[piece.type]} tại ${square}` : `Đi tới ${square}`}
            className={`xiangqi-square${selected === square ? ' is-selected' : ''}${isTarget ? ' is-target' : ''}${isHint ? ' is-hint' : ''}${isAnswer ? ' is-answer' : ''}`}
            style={{ '--xq-col': colIndex, '--xq-row': rowIndex }}
            onClick={() => clickSquare(rowIndex, colIndex)}
          >
            {piece && <img src={`${ASSET_ROOT}/${piece.color === 'r' ? 'red' : 'black'}_${PIECE_NAMES[piece.type]}.svg`} alt='' draggable='false' />}
          </button>
        )
      }))}
      {game.inCheck && <span className='xiangqi-board__check'>CHIẾU!</span>}
    </div>
  )
}

export default XiangqiBoard
