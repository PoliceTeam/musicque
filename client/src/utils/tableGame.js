export const syncTableGameTimer = (table, now = Date.now()) => ({ offset: (table?.serverNow ?? now) - now })
export const getTableGameRemaining = (table, sync, now = Date.now()) => table?.turnDeadlineAt ? Math.max(0, Math.ceil((new Date(table.turnDeadlineAt).getTime() - now - (sync?.offset || 0)) / 1000)) : 0

export const isRoomCode = code => /^[A-HJ-NP-Z2-9]{4}$/.test(code)
export const roomRemaining = (table, deadline, now = Date.now()) => getTableGameRemaining({ turnDeadlineAt: deadline }, syncTableGameTimer(table, table?.receivedAt ?? table?.serverNow ?? now), table?.receivedAt ? Math.max(now, table.receivedAt) : Math.max(now, Date.now()))
export const roomStatus = (table, now = Date.now()) => table.startsAt ? `Bắt đầu sau ${roomRemaining(table, table.startsAt, now)}` : table.status === 'finished' ? 'Vừa xong' : ['playing', 'settling'].includes(table.status) ? 'Đang chơi' : `Đang chờ ${table.seats.filter(Boolean).length}/4`
export const inviteUrl = code => `${window.location.origin}/card-games/thirteen?room=${encodeURIComponent(code)}`
export const stakeLabel = stake => stake > 0 ? `${stake} PC` : 'Chơi vui'
export const stakeOptionsOf = config => config?.stakeOptions?.length ? config.stakeOptions : [config?.stake]
// Chưa biết số dư (undefined) thì coi như đủ — server vẫn là nơi kiểm tra cuối cùng.
export const canAffordStake = (stake, balance) => !(stake > 0 && stake > balance)
export const stakeChangeNotice = stake => stake > 0 ? `Chủ bàn đổi mức cược thành ${stake} PC — hãy sẵn sàng lại` : 'Chủ bàn đổi sang chơi vui — hãy sẵn sàng lại'
export const stakeTone = stake => stake <= 0 ? 'blue' : stake <= 20 ? 'green' : stake <= 50 ? 'yellow' : 'red'
export const stakeTickLabel = stake => stake > 0 ? String(stake) : 'Vui'
// Match the 60/30/10/0 payout: the winner receives the remainder after rounding.
export const stakeMoneyHint = stake => {
  if (!(stake > 0)) return 'Chơi vui — không trừ PC'
  const pot = stake * 4
  const winner = pot - Math.floor(pot * 30 / 100) - Math.floor(pot * 10 / 100)
  return `Bàn đủ 4 người: quỹ ${pot} PC · nhất nhận ${winner} PC`
}
