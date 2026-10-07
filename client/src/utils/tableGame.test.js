import { describe, expect, it } from 'vitest'
import { syncTableGameTimer, getTableGameRemaining } from './tableGame'
describe('table game countdown', () => {
  it('counts down with server clock offset and clamps expiry', () => {
    const table = { serverNow: 10000, turnDeadlineAt: new Date(30000).toISOString() }
    const sync = syncTableGameTimer(table, 1000)
    expect(getTableGameRemaining(table, sync, 1000)).toBe(20)
    expect(getTableGameRemaining(table, sync, 21000)).toBe(0)
    expect(getTableGameRemaining(null, sync)).toBe(0)
  })
})
