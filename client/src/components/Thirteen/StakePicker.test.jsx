import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import StakePicker from './StakePicker'

const OPTIONS = [0, 10, 20, 50, 100]
const labels = () => screen.getAllByRole('radio').map(radio => radio.closest('label').textContent)

describe('StakePicker', () => {
  it('names the group and labels free play and PC tiers, checking the current one', () => {
    render(<StakePicker options={OPTIONS} value={20} onChange={vi.fn()} />)
    expect(screen.getByRole('radiogroup', { name: 'Mức cược' })).toBeInTheDocument()
    expect(labels()).toEqual(['Chơi vui', '10 PC', '20 PC', '50 PC', '100 PC'])
    expect(screen.getByRole('radio', { name: '20 PC' })).toBeChecked()
  })

  it('disables tiers above the balance, never free play, and explains why on hover', async () => {
    render(<StakePicker options={OPTIONS} value={10} balance={30} onChange={vi.fn()} />)
    for (const name of ['Chơi vui', '10 PC', '20 PC']) expect(screen.getByRole('radio', { name })).toBeEnabled()
    for (const name of ['50 PC', '100 PC']) expect(screen.getByRole('radio', { name })).toBeDisabled()
    await userEvent.hover(screen.getByText('50 PC'))
    expect(await screen.findByText('Không đủ PC cho mức này')).toBeInTheDocument()
  })

  it('treats an unknown balance as able to afford every tier', () => {
    render(<StakePicker options={OPTIONS} value={10} onChange={vi.fn()} />)
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeEnabled()
  })

  it('reports the chosen stake as a number', async () => {
    const onChange = vi.fn()
    render(<StakePicker options={OPTIONS} value={10} onChange={onChange} />)
    await userEvent.click(screen.getByText('50 PC'))
    expect(onChange).toHaveBeenCalledWith(50)
    await userEvent.click(screen.getByText('Chơi vui'))
    expect(onChange).toHaveBeenLastCalledWith(0)
  })

  it('disables every tier while locked', () => {
    render(<StakePicker options={OPTIONS} value={10} onChange={vi.fn()} disabled />)
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
  })
})
