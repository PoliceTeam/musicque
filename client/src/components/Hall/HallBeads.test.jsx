import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import HallBeads from './HallBeads'

afterEach(() => vi.useRealTimers())

it('cuộn liên tục vẫn nhận đều từng hạt, không dồn lượt sau khi dừng', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  const onBead = vi.fn()
  render(<HallBeads initial={0} onBead={onBead} onLap={() => {}} onClose={() => {}} />)
  const strand = screen.getByRole('slider')
  for (let i = 0; i < 50; i++) {
    fireEvent.wheel(strand, { deltaY: 120 })
    act(() => vi.advanceTimersByTime(20))
  }
  expect(onBead).toHaveBeenCalledTimes(6)
  act(() => vi.advanceTimersByTime(1000))
  expect(onBead).toHaveBeenCalledTimes(6)
  expect(strand).toHaveAttribute('aria-valuenow', '6')
})

it('cuộn trên số đếm cũng lần hạt', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  const onBead = vi.fn()
  render(<HallBeads initial={0} onBead={onBead} onLap={() => {}} onClose={() => {}} />)
  fireEvent.wheel(screen.getByText('0 / 108'), { deltaY: 120 })
  expect(onBead).toHaveBeenCalledOnce()
})

it('render lại vẫn dùng callback mới và báo đủ vòng đúng một lần', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  const old = vi.fn()
  const onBead = vi.fn()
  const onLap = vi.fn()
  const view = render(<HallBeads initial={107} onBead={old} onLap={old} onClose={() => {}} />)
  view.rerender(<HallBeads initial={107} onBead={onBead} onLap={onLap} onClose={() => {}} />)
  fireEvent.wheel(screen.getByRole('slider'), { deltaY: 120 })
  expect(old).not.toHaveBeenCalled()
  expect(onBead).toHaveBeenCalledOnce()
  expect(onLap).toHaveBeenCalledOnce()
  expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '0')
  act(() => vi.advanceTimersByTime(200))
  fireEvent.wheel(screen.getByRole('slider'), { deltaY: 120 })
  expect(onBead).toHaveBeenCalledTimes(2)
  expect(onLap).toHaveBeenCalledOnce()
})

it('khung hình bị trễ không khóa con lăn vĩnh viễn', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  const frame = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1)
  try {
    const onBead = vi.fn()
    render(<HallBeads initial={0} onBead={onBead} onLap={() => {}} onClose={() => {}} />)
    const strand = screen.getByRole('slider')
    fireEvent.wheel(strand, { deltaY: 120 })
    act(() => vi.advanceTimersByTime(200))
    fireEvent.wheel(strand, { deltaY: 120 })
    expect(onBead).toHaveBeenCalledTimes(2)
  } finally { frame.mockRestore() }
})

const pointer = (element, type, options) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...options })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  fireEvent(element, event)
}

it.each([0, 2])('nút chuột %s không kéo hạt và không khóa thao tác con lăn', (button) => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  const onBead = vi.fn()
  render(<HallBeads initial={0} onBead={onBead} onLap={() => {}} onClose={() => {}} />)
  const strand = screen.getByRole('slider')
  const before = [...strand.querySelectorAll('.hall-bead')].map((bead) => bead.style.transform)
  pointer(strand, 'pointerdown', { button, buttons: button === 0 ? 1 : 2, clientY: 100 })
  pointer(strand, 'pointermove', { buttons: button === 0 ? 1 : 2, clientY: 230 })
  act(() => vi.advanceTimersByTime(300))
  expect(onBead).not.toHaveBeenCalled()
  expect([...strand.querySelectorAll('.hall-bead')].map((bead) => bead.style.transform)).toEqual(before)
  fireEvent.wheel(strand, { deltaY: 120 })
  act(() => vi.advanceTimersByTime(300))
  expect(onBead).toHaveBeenCalledOnce()
  pointer(strand, 'pointerup', { button, buttons: 0, clientY: 230 })
  act(() => vi.advanceTimersByTime(300))
  fireEvent.wheel(strand, { deltaY: 120 })
  act(() => vi.advanceTimersByTime(300))
  expect(onBead).toHaveBeenCalledTimes(2)
})

it('cuộn theo dòng vẫn chuyển động và đếm một hạt', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  const onBead = vi.fn()
  render(<HallBeads initial={0} onBead={onBead} onLap={() => {}} onClose={() => {}} />)
  const strand = screen.getByRole('slider')
  const bead = strand.querySelector('.is-current')
  const before = bead.style.transform
  fireEvent.wheel(strand, { deltaY: 1, deltaMode: 1 })
  act(() => vi.advanceTimersByTime(80))
  expect(bead.style.transform).not.toBe(before)
  act(() => vi.advanceTimersByTime(300))
  expect(onBead).toHaveBeenCalledOnce()
  expect(strand).toHaveAttribute('aria-valuenow', '1')
})

it.each([[120, 0], [3, 1], [1, 2], [-120, 0], [0.5, 0]])('một lần cuộn deltaY=%s, deltaMode=%s chỉ lần một hạt', (deltaY, deltaMode) => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  const onBead = vi.fn()
  render(<HallBeads initial={0} onBead={onBead} onLap={() => {}} onClose={() => {}} />)
  const strand = screen.getByRole('slider')
  fireEvent.wheel(strand, { deltaY, deltaMode })
  act(() => vi.advanceTimersByTime(1000))
  expect(onBead).toHaveBeenCalledOnce()
  expect(strand).toHaveAttribute('aria-valuenow', '1')
})

it('cuộn liên tục giữ tốc độ cố định, dừng cuộn không chạy tiếp', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  const onBead = vi.fn()
  render(<HallBeads initial={0} onBead={onBead} onLap={() => {}} onClose={() => {}} />)
  const strand = screen.getByRole('slider')
  const bead = strand.querySelector('.is-current')
  for (let i = 0; i < 20; i++) {
    const event = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })
    fireEvent(strand, event)
    expect(event.defaultPrevented).toBe(true)
    act(() => vi.advanceTimersByTime(16))
    expect(bead.isConnected).toBe(true)
    const y = Number(bead.style.transform.match(/translateY\(([-\d.]+)/)[1])
    expect(y).toBeGreaterThanOrEqual(0)
    expect(y).toBeLessThanOrEqual(60)
  }
  act(() => vi.advanceTimersByTime(600))
  expect(onBead).toHaveBeenCalledTimes(2)
  expect(strand).toHaveAttribute('aria-valuenow', '2')
  const current = strand.querySelector('.is-current')
  const before = current.style.transform
  fireEvent.wheel(strand, { deltaY: -120, deltaMode: 0 })
  act(() => vi.advanceTimersByTime(80))
  expect(current.style.transform).not.toBe(before)
  act(() => vi.advanceTimersByTime(600))
  expect(onBead).toHaveBeenCalledTimes(3)
  expect(strand).toHaveAttribute('aria-valuenow', '3')
})

it('đổi chiều trong cùng một bước không hủy hoặc cộng thêm lượt lần hạt', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  const onBead = vi.fn()
  render(<HallBeads initial={0} onBead={onBead} onLap={() => {}} onClose={() => {}} />)
  const strand = screen.getByRole('slider')
  fireEvent.wheel(strand, { deltaY: 120 })
  fireEvent.wheel(strand, { deltaY: -120 })
  fireEvent.wheel(strand, { deltaY: 0, deltaX: 120 })
  act(() => vi.advanceTimersByTime(1000))
  expect(onBead).toHaveBeenCalledOnce()
  expect(strand).toHaveAttribute('aria-valuenow', '1')
})
