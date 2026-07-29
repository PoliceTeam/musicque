// Nhãn cửa cược
export const SIDE_LABEL = { cho: 'Chẵn', han: 'Lẻ' }

// Bố cục pip theo lưới 3x3 cho mặt 1..6
export const PIP_MAP = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

// Xúc xắc kiểu Á Đông: mặt 1 và 6 chấm đỏ, còn lại đen
export const isRedFace = (value) => value === 1 || value === 6

// Tính pha + số giây còn lại của vòng, dựa theo mốc thời gian server
export const getPhaseInfo = (round) => {
  if (!round) return { phase: 'idle', remaining: 0, label: 'Chờ vòng mới' }

  const now = Date.now()
  let endsAt = 0
  let label = ''

  switch (round.status) {
    case 'betting':
      endsAt = new Date(round.bettingEndsAt).getTime()
      label = 'Đặt cược'
      break
    case 'shaking':
      endsAt = new Date(round.shakeEndsAt).getTime()
      label = 'Đang lắc...'
      break
    case 'revealed':
      endsAt = new Date(round.revealEndsAt).getTime()
      label = 'Kết quả'
      break
    default:
      label = 'Chờ vòng mới'
  }

  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000))
  return { phase: round.status, remaining, label }
}
