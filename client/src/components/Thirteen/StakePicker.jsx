import React from 'react'
import { Segmented, Tooltip } from 'antd'
import { canAffordStake, stakeLabel } from '../../utils/tableGame'
// Chọn mức cược mỗi người; mức vượt số dư bị khoá kèm tooltip, "Chơi vui" (0) luôn chọn được.
export default function StakePicker({ options, value, balance, disabled, onChange }) {
  const items = options.map(stake => canAffordStake(stake, balance)
    ? { value: stake, label: stakeLabel(stake) }
    : { value: stake, disabled: true, label: <Tooltip title='Không đủ PC cho mức này' zIndex={1400}><span>{stakeLabel(stake)}</span></Tooltip> })
  return <Segmented aria-label='Mức cược' options={items} value={value} disabled={disabled} onChange={onChange} />
}
