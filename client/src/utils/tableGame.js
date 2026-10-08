export const syncTableGameTimer = (table, now = Date.now()) => ({ offset: (table?.serverNow ?? now) - now })
export const getTableGameRemaining = (table, sync, now = Date.now()) => table?.turnDeadlineAt ? Math.max(0, Math.ceil((new Date(table.turnDeadlineAt).getTime() - now - (sync?.offset || 0)) / 1000)) : 0

export const isRoomCode = code => /^[A-HJ-NP-Z2-9]{4}$/.test(code)
export const roomRemaining = (table, deadline, now = Date.now()) => getTableGameRemaining({ turnDeadlineAt: deadline }, syncTableGameTimer(table, table?.receivedAt ?? table?.serverNow ?? now), table?.receivedAt ? Math.max(now, table.receivedAt) : Math.max(now, Date.now()))
export const roomStatus = (table, now = Date.now()) => table.startsAt ? `Bắt đầu sau ${roomRemaining(table, table.startsAt, now)}` : table.status === 'finished' ? 'Vừa xong' : ['playing', 'settling'].includes(table.status) ? 'Đang chơi' : `Đang chờ ${table.seats.filter(Boolean).length}/4`
export const inviteUrl = code => `${window.location.origin}/games/thirteen?room=${encodeURIComponent(code)}`
