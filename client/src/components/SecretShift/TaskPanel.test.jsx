import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TaskPanel from './TaskPanel'

// Canvas được kiểm tra trong trình duyệt; kiểm tra ranh giới kết quả/server tại đây.
vi.mock('./TaskGame', () => ({ default: ({ challenge, enabled, onAnswer }) =>
  <button disabled={!enabled} onClick={() => onAnswer(challenge.kind === 'wiring' ? [3, 0, 1, 2] : challenge.kind === 'code' ? '1234' : true)}>Hoàn thành canvas</button> }))

describe('nhiệm vụ Phaser gửi kết quả về server', () => {
  it('gửi vị trí dây đã xáo trộn do canvas cung cấp', async () => {
    const act = vi.fn(async () => true)
    render(<TaskPanel challenge={{ id: 'wire', kind: 'wiring', startedAt: 1000, order: [1, 2, 3, 0] }} now={5000} act={act} online />)
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành canvas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    await waitFor(() => expect(act).toHaveBeenCalledWith({ kind: 'taskComplete', challengeId: 'wire', answer: [3, 0, 1, 2] }))
  })
  it('không xác nhận khi chưa đủ thời gian hoặc mất mạng', () => {
    const act = vi.fn()
    const props = { challenge: { id: 'code', kind: 'code', startedAt: 1000, code: '1234' }, act }
    const view = render(<TaskPanel {...props} now={2000} online />)
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành canvas' }))
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()
    view.rerender(<TaskPanel {...props} now={5000} online={false} />)
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Hoàn thành canvas' })).toBeDisabled()
    expect(act).not.toHaveBeenCalled()
  })
  it('khóa thao tác trong khi server đang xác nhận nhiệm vụ khởi động', async () => {
    let resolve
    const act = vi.fn(() => new Promise(r => { resolve = r }))
    render(<TaskPanel challenge={{ id: 'restart', kind: 'restart', startedAt: 1000 }} now={5000} act={act} online />)
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành canvas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }))
    expect(act).toHaveBeenCalledWith({ kind: 'taskComplete', challengeId: 'restart', answer: '' })
    expect(screen.getByRole('button', { name: 'Hoàn thành canvas' })).toBeDisabled()
    resolve(false)
    await waitFor(() => expect(screen.getByText(/Đáp án chưa đúng/)).toBeInTheDocument())
  })
})
