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

it('builds invite links to the games lobby so old /thirteen links are no longer minted', async () => {
  const { inviteUrl } = await import('./tableGame')
  expect(inviteUrl('K7Q2')).toBe(`${window.location.origin}/card-games/thirteen?room=K7Q2`)
})

it('validates unambiguous room codes and counts down with server offset after receipt', async () => {
  const { isRoomCode, roomRemaining, roomStatus } = await import('./tableGame')
  expect(isRoomCode('K7Q2')).toBe(true)
  for (const code of ['OI01', 'k7q2', 'ABC', 'ABCDE', 'AB C']) expect(isRoomCode(code)).toBe(false)
  const table = { serverNow: 10000, receivedAt: 1000, startsAt: 13000, status: 'waiting', seats: [{}] }
  expect(roomRemaining(table, table.startsAt, 1000)).toBe(3)
  expect(roomRemaining(table, table.startsAt, 2000)).toBe(2)
  expect(roomRemaining(table, table.startsAt, 5000)).toBe(0)
  expect(roomStatus(table, 2000)).toBe('Bắt đầu sau 2')
})

it('formats stakes: 0 is free play, anything else is PC per player', async () => {
  const { stakeLabel, stakeOptionsOf, canAffordStake, stakeChangeNotice } = await import('./tableGame')
  expect(stakeLabel(0)).toBe('Chơi vui')
  expect(stakeLabel(50)).toBe('50 PC')
  expect(stakeOptionsOf({ stake: 10 })).toEqual([10])
  expect(stakeOptionsOf({ stake: 10, stakeOptions: [0, 10, 20] })).toEqual([0, 10, 20])
  expect(canAffordStake(50, 20)).toBe(false)
  expect(canAffordStake(20, 20)).toBe(true)
  expect(canAffordStake(0, 0)).toBe(true)
  expect(canAffordStake(10, undefined)).toBe(true)
  expect(stakeChangeNotice(50)).toBe('Chủ bàn đổi mức cược thành 50 PC — hãy sẵn sàng lại')
  expect(stakeChangeNotice(0)).toBe('Chủ bàn đổi sang chơi vui — hãy sẵn sàng lại')
})

it('colours a stake by risk: free blue, 10–20 green, 50 yellow, 100 red', async () => {
  const { stakeTone } = await import('./tableGame')
  expect([0, 10, 20, 50, 100].map(stakeTone)).toEqual(['blue', 'green', 'green', 'yellow', 'red'])
  expect([5, 30, 200].map(stakeTone)).toEqual(['green', 'yellow', 'red'])
})

it('labels slider ticks short: Vui for free play, the bare amount otherwise', async () => {
  const { stakeTickLabel } = await import('./tableGame')
  expect([0, 10, 100].map(stakeTickLabel)).toEqual(['Vui', '10', '100'])
})

it('explains the money at stake for a full table, with the server payout split (60/30/10/0, remainder to the winner)', async () => {
  const { stakeMoneyHint } = await import('./tableGame')
  expect(stakeMoneyHint(0)).toBe('Chơi vui — không trừ PC')
  expect(stakeMoneyHint(10)).toBe('Bàn đủ 4 người: quỹ 40 PC · nhất nhận 24 PC')
  expect(stakeMoneyHint(100)).toBe('Bàn đủ 4 người: quỹ 400 PC · nhất nhận 240 PC')
  // A 28 PC pot rounds second/third down to 8/2, leaving 18 for the winner.
  expect(stakeMoneyHint(7)).toBe('Bàn đủ 4 người: quỹ 28 PC · nhất nhận 18 PC')
})
