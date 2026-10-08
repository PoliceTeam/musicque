import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import StakePicker from './StakePicker'

const OPTIONS = [0, 10, 20, 50, 100]
const slider = () => screen.getByRole('slider', { name: 'Mức cược' })
// Trình duyệt tự đổi value của input[type=range] khi bấm tick, kéo hoặc nhấn mũi tên; test mô phỏng đúng sự kiện change đó.
const moveTo = index => fireEvent.change(slider(), { target: { value: String(index) } })

describe('StakePicker', () => {
  it('is a slider over the stops whose value text is the stake label', () => {
    render(<StakePicker options={OPTIONS} value={20} onChange={vi.fn()} />)
    expect(slider()).toHaveAttribute('min', '0')
    expect(slider()).toHaveAttribute('max', '4')
    expect(slider()).toHaveValue('2')
    expect(slider()).toHaveAttribute('aria-valuetext', '20 PC')
    expect(screen.getByText('20 PC')).toBeInTheDocument()
  })

  it('calls free play "Chơi vui" in both the value text and the visible label', () => {
    render(<StakePicker options={OPTIONS} value={0} onChange={vi.fn()} />)
    expect(slider()).toHaveAttribute('aria-valuetext', 'Chơi vui')
    expect(screen.getByText('Chơi vui')).toBeInTheDocument()
  })

  it('reports the stop it moved to as a number', () => {
    const onChange = vi.fn()
    render(<StakePicker options={OPTIONS} value={10} onChange={onChange} />)
    moveTo(3)
    expect(onChange).toHaveBeenLastCalledWith(50)
    moveTo(0)
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('draws one tick per stop and leaves the shimmer for the top stop only', () => {
    const { container, rerender } = render(<StakePicker options={OPTIONS} value={20} onChange={vi.fn()} />)
    expect(container.querySelectorAll('.stake-slider__tick')).toHaveLength(5)
    expect(container.querySelector('[data-max]')).toBeNull()
    rerender(<StakePicker options={OPTIONS} value={100} onChange={vi.fn()} />)
    expect(container.querySelector('[data-max]')).not.toBeNull()
  })

  it('leaves the fill empty on the first stop', () => {
    const { container, rerender } = render(<StakePicker options={OPTIONS} value={0} onChange={vi.fn()} />)
    expect(container.querySelector('[data-min]')).not.toBeNull()
    rerender(<StakePicker options={OPTIONS} value={10} onChange={vi.fn()} />)
    expect(container.querySelector('[data-min]')).toBeNull()
  })

  it('keeps unaffordable stops visible but dimmed, and says why', () => {
    const { container } = render(<StakePicker options={OPTIONS} value={10} balance={30} onChange={vi.fn()} />)
    expect(container.querySelectorAll('.stake-slider__tick')).toHaveLength(5)
    expect([...container.querySelectorAll('[data-locked]')]).toHaveLength(2)
    expect(screen.getByText('Không đủ PC cho mức từ 50 PC trở lên')).toBeInTheDocument()
  })

  it('snaps a move onto a locked stop to the nearest affordable one', () => {
    const onChange = vi.fn()
    render(<StakePicker options={OPTIONS} value={0} balance={30} onChange={onChange} />)
    moveTo(4)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(20)
  })

  it('does not move when the next stop up is locked, as when pressing ArrowRight on the last affordable one', () => {
    const onChange = vi.fn()
    render(<StakePicker options={OPTIONS} value={20} balance={30} onChange={onChange} />)
    moveTo(3)
    moveTo(4)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('steps over a locked stop to the next open one', () => {
    const onChange = vi.fn()
    render(<StakePicker options={[0, 100, 10]} value={0} balance={50} onChange={onChange} />)
    moveTo(1)
    expect(onChange).toHaveBeenCalledWith(10)
  })

  it('is a tab stop; arrow stepping itself is native input[type=range] behaviour', async () => {
    render(<StakePicker options={OPTIONS} value={10} onChange={vi.fn()} />)
    await userEvent.tab()
    expect(slider()).toHaveFocus()
  })

  it('treats an unknown balance as able to afford every stop, with no hint', () => {
    const { container } = render(<StakePicker options={OPTIONS} value={10} onChange={vi.fn()} />)
    expect(container.querySelector('[data-locked]')).toBeNull()
    expect(screen.queryByText(/Không đủ PC/)).not.toBeInTheDocument()
  })

  it('locks the whole slider when disabled', () => {
    render(<StakePicker options={OPTIONS} value={10} onChange={vi.fn()} disabled />)
    expect(slider()).toBeDisabled()
  })

  it('copes with a single stop from an older server', () => {
    render(<StakePicker options={[10]} value={10} onChange={vi.fn()} />)
    expect(slider()).toHaveAttribute('max', '0')
    expect(slider()).toHaveAttribute('aria-valuetext', '10 PC')
  })
})
