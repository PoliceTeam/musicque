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
    expect(container.querySelectorAll('.stake-slider__tick[data-locked]')).toHaveLength(2)
    expect(container.querySelectorAll('.stake-slider__tick-label[data-locked]')).toHaveLength(2)
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

  it('puts the label on the left and the value on the right of one header row above the track', () => {
    const { container } = render(<StakePicker options={OPTIONS} value={20} onChange={vi.fn()} label='Mức cược mỗi người' />)
    const head = container.querySelector('.stake-slider__head')
    expect([...head.children].map(node => node.className)).toEqual(['stake-slider__label', 'stake-slider__value'])
    expect(head).toHaveTextContent('Mức cược mỗi người20 PC')
    expect(head.nextElementSibling).toHaveClass('stake-slider__track')
    expect(slider()).toHaveAccessibleName('Mức cược')
  })

  it('labels itself "Mức cược" by default', () => {
    const { container } = render(<StakePicker options={OPTIONS} value={20} onChange={vi.fn()} />)
    expect(container.querySelector('.stake-slider__label')).toHaveTextContent(/^Mức cược$/)
  })

  it('tints the slider by risk with the Politetech tone classes', () => {
    const toneOf = value => render(<StakePicker options={OPTIONS} value={value} onChange={vi.fn()} />).container.firstChild
    expect(toneOf(0)).toHaveClass('cgl-tone--blue')
    expect(toneOf(10)).toHaveClass('cgl-tone--green')
    expect(toneOf(20)).toHaveClass('cgl-tone--green')
    expect(toneOf(50)).toHaveClass('cgl-tone--yellow')
    expect(toneOf(100)).toHaveClass('cgl-tone--red')
  })

  it('shows a short label under every tick, bold on the selected one', () => {
    const { container } = render(<StakePicker options={OPTIONS} value={20} onChange={vi.fn()} />)
    const labels = [...container.querySelectorAll('.stake-slider__tick-label')]
    expect(labels.map(node => node.textContent)).toEqual(['Vui', '10', '20', '50', '100'])
    expect(labels.map(node => node.hasAttribute('data-active'))).toEqual([false, false, true, false, false])
  })

  it('selects a stop when its label is clicked, but not a locked or disabled one', async () => {
    const onChange = vi.fn()
    const { rerender } = render(<StakePicker options={OPTIONS} value={10} balance={30} onChange={onChange} />)
    await userEvent.click(screen.getByText('20'))
    expect(onChange).toHaveBeenLastCalledWith(20)
    await userEvent.click(screen.getByText('Vui'))
    expect(onChange).toHaveBeenLastCalledWith(0)
    onChange.mockClear()
    await userEvent.click(screen.getByText('50'))
    expect(onChange).not.toHaveBeenCalled()
    rerender(<StakePicker options={OPTIONS} value={10} balance={30} onChange={onChange} disabled />)
    await userEvent.click(screen.getByText('20'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps tick labels out of the accessibility tree and out of the tab order; the slider stays the one control', () => {
    const { container } = render(<StakePicker options={OPTIONS} value={20} onChange={vi.fn()} />)
    expect(container.querySelectorAll('.stake-slider__tick-label')).toHaveLength(5)
    for (const label of container.querySelectorAll('.stake-slider__tick-label')) {
      expect(label).toHaveAttribute('aria-hidden', 'true')
      expect(label).toHaveAttribute('tabindex', '-1')
    }
    expect(screen.getAllByRole('slider')).toHaveLength(1)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('explains the money at stake in one muted line, and the low-balance hint uses the same style', () => {
    const { container, rerender } = render(<StakePicker options={OPTIONS} value={20} balance={30} onChange={vi.fn()} />)
    const notes = [...container.querySelectorAll('.stake-slider__note')]
    expect(notes.map(node => node.textContent)).toEqual(['Bàn đủ 4 người: quỹ 80 PC · nhất nhận 48 PC', 'Không đủ PC cho mức từ 50 PC trở lên'])
    expect(slider().getAttribute('aria-describedby').split(' ')).toEqual(notes.map(node => node.id))
    rerender(<StakePicker options={OPTIONS} value={0} onChange={vi.fn()} />)
    expect(container.querySelector('.stake-slider__note')).toHaveTextContent('Chơi vui — không trừ PC')
  })
})
