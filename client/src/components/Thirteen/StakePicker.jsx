import React, { useId } from 'react'
import { canAffordStake, stakeLabel } from '../../utils/tableGame'
// Thanh chọn mức cược rời rạc: mỗi stop là một mức, kéo / bấm tick / phím mũi tên đều dùng input[type=range] gốc.
// Mức vượt số dư vẫn hiện (tick mờ) nhưng thumb không đậu được lên đó; "Chơi vui" (0) luôn chọn được.
export default function StakePicker({ options, value, balance, disabled, onChange }) {
  const hintId = useId()
  const last = options.length - 1
  const index = Math.max(0, options.indexOf(value))
  const open = options.map(stake => canAffordStake(stake, balance))
  const ratio = i => (last > 0 ? i / last : 0)
  // Đích rơi vào mức bị khoá thì dán vào mức mở gần nhất; hoà khoảng cách thì ưu tiên hướng đang di chuyển (nhảy qua mức khoá).
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
  return <div className='stake-slider' data-disabled={disabled || undefined}>
    <strong className='stake-slider__value' aria-hidden='true'>{stakeLabel(options[index])}</strong>
    <div className='stake-slider__track' style={{ '--p': ratio(index) }} data-min={index === 0 || undefined} data-max={(last > 0 && index === last && open[last]) || undefined}>
      <span className='stake-slider__fill' />
      {options.map((stake, i) => <span key={stake} aria-hidden='true' className='stake-slider__tick' style={{ '--p': ratio(i) }} data-on={i <= index || undefined} data-locked={!open[i] || undefined} />)}
      <span className='stake-slider__thumb' aria-hidden='true' />
      <input type='range' min={0} max={last} step={1} value={index} disabled={disabled} onChange={move} aria-label='Mức cược' aria-valuetext={stakeLabel(options[index])} aria-describedby={firstLocked === undefined ? undefined : hintId} />
    </div>
    {firstLocked !== undefined && <small id={hintId} className='stake-slider__hint'>Không đủ PC cho mức từ {stakeLabel(firstLocked)} trở lên</small>}
  </div>
}
