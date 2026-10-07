import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaylistContext } from '../../contexts/PlaylistContext'
import XiangqiPvp from './XiangqiPvp'
import * as api from '../../services/api'

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'red' }, requireAuth: () => true, refreshBalance: vi.fn() }) }))
vi.mock('../../services/api', () => ({
  getActiveXiangqiPvp: vi.fn(), getXiangqiPvp: vi.fn(), createXiangqiPvp: vi.fn(),
  joinXiangqiPvp: vi.fn(), moveXiangqiPvp: vi.fn(), actionXiangqiPvp: vi.fn(),
}))
const board = Array.from({ length: 10 }, () => Array(9).fill(null))
const room = { id: 'room', code: '1234ABCD', red: 'An', black: null, myColor: 'r', turn: 'r', plyVersion: 0, status: 'waiting', stake: 30, pot: 0, board, legalMoves: [] }
let handlers
let socket
const show = () => render(<PlaylistContext.Provider value={{ socket }}><XiangqiPvp /></PlaylistContext.Provider>)
beforeEach(() => {
  vi.clearAllMocks()
  handlers = {}
  socket = { on: vi.fn((event, fn) => { handlers[event] = fn }), off: vi.fn() }
  api.getActiveXiangqiPvp.mockResolvedValue({ data: { game: null } })
})

describe('Xiangqi PvP', () => {
  it('tạo phòng và hiện mã để mời bạn bè', async () => {
    api.createXiangqiPvp.mockResolvedValue({ data: { game: room } })
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo phòng' }))
    expect(await screen.findByText('1234ABCD')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hủy phòng' })).toBeInTheDocument()
  })

  it('vào phòng qua mã nhập và hiện đúng lượt', async () => {
    api.joinXiangqiPvp.mockResolvedValue({ data: { game: { ...room, black: 'Bình', myColor: 'b', status: 'playing', plyVersion: 1 } } })
    show()
    const input = await screen.findByLabelText('Hoặc nhập mã phòng của bạn bè')
    fireEvent.change(input, { target: { value: '1234abcd' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vào phòng' }))
    expect(await screen.findByText('Đến lượt đối thủ')).toBeInTheDocument()
    expect(api.joinXiangqiPvp).toHaveBeenCalledWith('1234ABCD')
  })

  it('khôi phục phòng và nhận thông báo đối thủ vào qua socket dùng chung', async () => {
    api.getActiveXiangqiPvp.mockResolvedValue({ data: { game: room } })
    api.getXiangqiPvp.mockResolvedValue({ data: { game: { ...room, black: 'Bình', status: 'playing', plyVersion: 1 } } })
    const view = show()
    expect(await screen.findByText('1234ABCD')).toBeInTheDocument()
    await waitFor(() => expect(handlers['xiangqi:pvp_updated']).toBeDefined())
    await act(async () => handlers['xiangqi:pvp_updated']({ id: 'another-room' }))
    expect(api.getXiangqiPvp).not.toHaveBeenCalled()
    await act(async () => handlers['xiangqi:pvp_updated']({ id: 'room' }))
    expect(await screen.findByText('Đến lượt bạn')).toBeInTheDocument()
    expect(api.getXiangqiPvp).toHaveBeenCalledWith('room')
    view.unmount()
    expect(socket.off).toHaveBeenCalledWith('xiangqi:pvp_updated', expect.any(Function))
  })

  it('đề nghị hòa và kết quả được xác nhận bởi server', async () => {
    api.getActiveXiangqiPvp.mockResolvedValue({ data: { game: { ...room, black: 'Bình', status: 'playing', plyVersion: 5, drawOfferedBy: 'b' } } })
    api.actionXiangqiPvp.mockResolvedValue({ data: { game: { ...room, status: 'finished', winner: 'draw', funded: true, pot: 60, resultReason: 'agreement', plyVersion: 6 } } })
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Đồng ý hòa' }))
    expect(await screen.findByText('Ván cờ hòa')).toBeInTheDocument()
    expect(screen.getByText('Đã hoàn 30 PC tiền cược.')).toBeInTheDocument()
    expect(api.actionXiangqiPvp).toHaveBeenCalledWith('room', 'accept_draw', 5)
    fireEvent.click(screen.getByRole('button', { name: 'Về sảnh PvP' }))
    expect(screen.getByRole('button', { name: 'Tạo phòng' })).toBeInTheDocument()
  })
})
