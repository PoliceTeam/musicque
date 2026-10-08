import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { it, expect, vi } from 'vitest'
import { MatchScreens } from './MatchScreens'
const fixture = (phase = 'lobby') => ({ phase, matchId: 'ABC123', hostId: 'u0', me: { userId: 'u0', role: 'crew' },
  roster: Array.from({ length: 4 }, (_, i) => ({ userId: `u${i}`, displayName: `Người ${i}`, skin: i, ready: true, connected: true, role: i ? 'crew' : 'saboteur' })),
  result: { winner: 'crew', reason: 'Hoàn thành nhiệm vụ.' } })
it('chỉ cho bắt đầu khi đủ người sẵn sàng và kết nối', () => {
  const state = fixture(); state.roster[1].ready = false
  const act = vi.fn(); const { rerender } = render(<MatchScreens state={state} online act={act} leave={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Bắt đầu trận' })).toBeDisabled()
  state.roster[1].ready = true; rerender(<MatchScreens state={state} online act={act} leave={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu trận' })); expect(act).toHaveBeenCalledWith({ kind: 'start' })
})
it('kết quả theo đội của người chơi, chủ phòng chơi lại và có thể về menu', () => {
  const state = fixture('ended'); const act = vi.fn(); const leave = vi.fn()
  const { rerender } = render(<MatchScreens state={state} online act={act} leave={leave} />)
  expect(screen.getByRole('heading', { name: 'Chiến thắng!' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Chơi lại · về phòng chờ' })); expect(act).toHaveBeenCalledWith({ kind: 'rematch' })
  state.me.role = 'saboteur'; state.hostId = 'u1'; rerender(<MatchScreens state={state} online act={act} leave={leave} />)
  expect(screen.getByRole('heading', { name: 'Thất bại' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Chơi lại · về phòng chờ' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Về menu chính' })); expect(leave).toHaveBeenCalled()
})
