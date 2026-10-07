export const syncTableGameTimer = (table, now = Date.now()) => ({ offset: (table?.serverNow ?? now) - now })
export const getTableGameRemaining = (table, sync, now = Date.now()) => table?.turnDeadlineAt ? Math.max(0, Math.ceil((new Date(table.turnDeadlineAt).getTime() - now - (sync?.offset || 0)) / 1000)) : 0
