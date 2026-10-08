import React, { useId } from 'react'
import { canAffordStake, stakeLabel, stakeMoneyHint, stakeTickLabel, stakeTone } from '../../utils/tableGame'
// The native range owns keyboard and screen-reader interaction; tick labels are pointer shortcuts.
export default function StakePicker({ options, value, balance, disabled, onChange, label = 'Mức cược' }) {
  const moneyId = useId()
  const hintId = useId()
  const last = options.length - 1
  const index = Math.max(0, options.indexOf(value))
  const open = options.map(stake => canAffordStake(stake, balance))
  const ratio = i => (last > 0 ? i / last : 0)
  // Snap to an affordable stop, breaking ties in the direction of travel.
  const snap = target => {
    const direction = Math.sign(target - index)
    let best = index
    let bestScore = Infinity
    options.forEach((_, i) => {
      if (!open[i]) return
      const score = Math.abs(i - target) * 2 + ((i - target) * direction >= 0 ? 0 : 1)
      if (score < bestScore) { best = i; bestScore = score }
    })
    return best
  }
  const move = event => { const next = snap(Number(event.target.value)); if (next !== index) onChange(options[next]) }
  const firstLocked = options.find((_, i) => !open[i])
  const describedBy = [moneyId, firstLocked === undefined ? null : hintId].filter(Boolean).join(' ')
  return <div className={`stake-slider cgl-tone--${stakeTone(options[index])}`} data-disabled={disabled || undefined}>
    <div className='stake-slider__head'>
      <span className='stake-slider__label'>{label}</span>
      <strong className='stake-slider__value' aria-hidden='true'>{stakeLabel(options[index])}</strong>
    </div>
    <div className='stake-slider__track' style={{ '--p': ratio(index) }} data-min={index === 0 || undefined} data-max={(last > 0 && index === last && open[last]) || undefined}>
      <span className='stake-slider__fill' />
      {options.map((stake, i) => <span key={stake} aria-hidden='true' className='stake-slider__tick' style={{ '--p': ratio(i) }} data-on={i <= index || undefined} data-locked={!open[i] || undefined} />)}
      <span className='stake-slider__thumb' aria-hidden='true' />
      <input type='range' min={0} max={last} step={1} value={index} disabled={disabled} onChange={move} aria-label='Mức cược' aria-valuetext={stakeLabel(options[index])} aria-describedby={describedBy} />
    </div>
    <div className='stake-slider__labels'>
      {options.map((stake, i) => <button key={stake} type='button' tabIndex={-1} aria-hidden='true' className='stake-slider__tick-label' style={{ '--p': ratio(i) }} data-active={i === index || undefined} data-locked={!open[i] || undefined} disabled={disabled || !open[i]} onClick={() => { if (i !== index) onChange(stake) }}>{stakeTickLabel(stake)}</button>)}
    </div>
    <small id={moneyId} className='stake-slider__note'>{stakeMoneyHint(options[index])}</small>
    {firstLocked !== undefined && <small id={hintId} className='stake-slider__note'>Không đủ PC cho mức từ {stakeLabel(firstLocked)} trở lên</small>}
  </div>
}
