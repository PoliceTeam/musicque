export function tableBoardText(table, now = Date.now()) {
  const humans = table.seats.filter(seat => seat && !seat.isBot).length
  const seconds = value => Math.max(0, Math.ceil((new Date(value).getTime() - now) / 1000))
  const start = table.startsAt && seconds(table.startsAt)
  const ready = table.readyDeadlineAt && seconds(table.readyDeadlineAt)
  return [
    `Bàn ${table.code || '—'}${table.visibility === 'private' ? ' 🔒' : ''}`,
    start ? `Bắt đầu sau ${start}` : table.status === 'playing' || table.status === 'settling' ? 'Đang chơi' : table.status === 'finished' ? 'Kết thúc' : `Đang chờ ${humans}/${table.seats.length}`,
    table.pot > 0 ? `Quỹ ${table.pot} PC` : 'Ván tập',
    ready ? `Ván mới sau ${ready}s` : '',
  ]
}
