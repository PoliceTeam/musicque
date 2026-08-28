export const getWordChainRemaining = (round, now = Date.now()) => {
  if (!round) return 0
  const endsAt = round.status === 'waiting' ? round.idleEndsAt : round.deadlineAt
  if (!endsAt) return 0
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000))
}

export const getWordChainPhaseLabel = (round) => {
  if (!round) return 'Đang chuẩn bị'
  if (round.status === 'waiting') return 'Chờ người mở lượt'
  if (round.status === 'playing') return 'Nhanh tay nối tiếp'
  if (round.status === 'settled') return 'Đã có người thắng'
  if (round.status === 'voided') return 'Ván đã kết thúc'
  return 'Đang chốt kết quả'
}

export const canSubmitWordChain = ({ round, userId, balance, remaining }) => {
  if (!round || !['waiting', 'playing'].includes(round.status) || remaining <= 0) return false
  if (!userId || balance < 1) return false
  return round.lastPlayer?.userId?.toString() !== userId.toString()
}
