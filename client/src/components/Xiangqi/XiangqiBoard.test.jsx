import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import XiangqiBoard from './XiangqiBoard'
import XiangqiRulesModal from './XiangqiRulesModal'
import XiangqiPromo from './XiangqiPromo'

const emptyBoard = () => Array.from({ length: 10 }, () => Array(9).fill(null))

describe('XiangqiBoard', () => {
  it('chỉ gửi nước sau khi chọn quân Đỏ và một đích hợp lệ', () => {
    const board = emptyBoard()
    board[8][6] = { color: 'r', type: 'r' }
    const onMove = vi.fn()
    render(
      <XiangqiBoard
        game={{ board, legalMoves: [{ from: 'g1', to: 'g4' }], inCheck: false }}
        onMove={onMove}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Đỏ rook tại g1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Đi tới g4' }))
    expect(onMove).toHaveBeenCalledWith('g1', 'g4')
  })

  it('không cho thao tác khi đang đợi NPC', () => {
    const board = emptyBoard()
    board[8][6] = { color: 'r', type: 'r' }
    const onMove = vi.fn()
    render(
      <XiangqiBoard
        game={{ board, legalMoves: [{ from: 'g1', to: 'g4' }], inCheck: false }}
        disabled
        onMove={onMove}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Đỏ rook tại g1' }))
    expect(onMove).not.toHaveBeenCalled()
  })
})

describe('XiangqiRulesModal', () => {
  it('phổ biến cược/thưởng nhưng không công bố giới hạn thưởng nội bộ', () => {
    render(<XiangqiRulesModal open onClose={() => {}} />)
    expect(screen.getByText(/cược 10 PC/i)).toBeInTheDocument()
    expect(screen.getByText(/Khó \+66 PC/i)).toBeInTheDocument()
    expect(screen.getByText(/Dễ 40 giây.*Trung bình 60 giây.*Khó 90 giây/i)).toBeInTheDocument()
    expect(screen.getByText(/Hết giờ vẫn được chơi tiếp/i)).toBeInTheDocument()
    expect(screen.queryByText(/500 PC/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/tối đa/i)).not.toBeInTheDocument()
  })
})

describe('XiangqiPromo', () => {
  it('cho phép ẩn banner nổi', () => {
    const onDismiss = vi.fn()
    render(<MemoryRouter><XiangqiPromo onDismiss={onDismiss} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn quảng bá cờ tướng' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
