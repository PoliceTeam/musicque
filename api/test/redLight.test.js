const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../services/redLight/engine')

const user = (n) => ({
  _id: `user-${n}`,
  displayName: `Player ${n}`,
  avatarId: 'cat',
  color: '#4ECDC4',
})

const joinMany = (state, count, now) => {
  for (let index = 1; index <= count; index += 1) {
    const result = engine.joinLobby(state, user(index), now)
    assert.equal(result.ok, true)
  }
}

test('không start countdown khi chưa đủ 4 người', () => {
  const state = engine.createInitialState('session-1')
  joinMany(state, 3, 1000)
  assert.equal(engine.maybeStartCountdown(state, 1000), false)
  assert.equal(state.status, engine.STATUS.LOBBY)
})

test('đủ 4 người thì countdown rồi khóa join', () => {
  const state = engine.createInitialState('session-1')
  joinMany(state, 4, 1000)
  assert.equal(engine.maybeStartCountdown(state, 1000), true)
  assert.equal(state.status, engine.STATUS.COUNTDOWN)
  const fifth = engine.joinLobby(state, user(5), 1100)
  assert.equal(fifth.ok, false)
  assert.equal(fifth.code, 'COUNTDOWN_LOCKED')
})

test('rớt dưới 4 người lúc countdown thì hủy ván', () => {
  const state = engine.createInitialState('session-1')
  joinMany(state, 4, 1000)
  engine.maybeStartCountdown(state, 1000)
  engine.removeFromLobby(state, 'user-4')
  const { events } = engine.tick(state, 1200)
  assert.ok(events.includes('countdown_cancelled'))
  assert.equal(state.status, engine.STATUS.LOBBY)
})

test('giữ phím lúc đèn xanh thì tiến, đèn đỏ thì bị loại sau grace', () => {
  const schedule = [
    { type: engine.PHASE.GREEN, startAt: 0, endAt: 1000 },
    { type: engine.PHASE.TURNING_RED, startAt: 1000, endAt: 1400 },
    { type: engine.PHASE.RED, startAt: 1400, endAt: 3000 },
  ]
  const player = engine.createPlayer(user(1), 0)
  player.holding = true
  engine.tickProgress({ status: engine.STATUS.PLAYING, schedule, players: [player] }, 500, 500)
  assert.ok(player.progress > 0)
  assert.equal(player.status, engine.PLAYER_STATUS.ALIVE)

  engine.applyInput(
    { status: engine.STATUS.PLAYING, round: { schedule, players: [player] } },
    'user-1',
    true,
    1400 + engine.GRACE_MS,
  )
  assert.equal(player.status, engine.PLAYER_STATUS.ELIMINATED)
  assert.equal(player.eliminatedReason, 'moved_on_red')
})

test('pha quay mặt vẫn được chạy, chưa phải đèn đỏ', () => {
  const schedule = [
    { type: engine.PHASE.TURNING_RED, startAt: 0, endAt: 400 },
    { type: engine.PHASE.RED, startAt: 400, endAt: 2000 },
  ]
  assert.equal(engine.phaseAllowsRun(engine.getPhaseAt(schedule, 200)), true)
  assert.equal(engine.isLethalRed(engine.getPhaseAt(schedule, 200), 200), false)
  assert.equal(engine.isLethalRed(engine.getPhaseAt(schedule, 400), 400), false)
  assert.equal(engine.isLethalRed(engine.getPhaseAt(schedule, 400 + engine.GRACE_MS), 400 + engine.GRACE_MS), true)
})

test('hạng theo về đích trước, rồi progress; thưởng 25/10/5', () => {
  const players = [
    { userId: 'a', displayName: 'A', status: 'finished', progress: 100, finishedAt: 50 },
    { userId: 'b', displayName: 'B', status: 'alive', progress: 80, finishedAt: null },
    { userId: 'c', displayName: 'C', status: 'alive', progress: 40, finishedAt: null },
    { userId: 'd', displayName: 'D', status: 'eliminated', progress: 90, finishedAt: null },
  ]
  const ranked = engine.rankPlayers(players)
  assert.deepEqual(ranked.map((player) => player.userId), ['a', 'b', 'c'])
  const payouts = engine.assignPayouts(ranked)
  assert.equal(payouts[0].requestedPayout, 25)
  assert.equal(payouts[1].requestedPayout, 10)
  assert.equal(payouts[2].requestedPayout, 5)
})

test('mô phỏng đủ 4 người: một người về đích thì ván chốt', () => {
  const randomInt = () => 2000
  let now = 0
  const state = engine.createInitialState('session-1')
  joinMany(state, 4, now)
  engine.maybeStartCountdown(state, now)
  now = engine.COUNTDOWN_MS
  engine.tick(state, now, 100, randomInt)
  assert.equal(state.status, engine.STATUS.PLAYING)
  assert.equal(state.round.players.length, 4)

  const leaderId = 'user-1'
  engine.applyInput(state, leaderId, true, now + 10)
  const greenPhase = state.round.schedule.find((phase) => phase.type === engine.PHASE.GREEN)
  let cursor = greenPhase.startAt
  while (cursor < greenPhase.endAt && state.status === engine.STATUS.PLAYING) {
    engine.tick(state, cursor, 100, randomInt)
    cursor += 100
  }

  // Keep holding across enough green phases to finish.
  while (state.status === engine.STATUS.PLAYING) {
    const phase = engine.getPhaseAt(state.round.schedule, cursor)
    if (engine.phaseAllowsRun(phase)) engine.applyInput(state, leaderId, true, cursor)
    else engine.applyInput(state, leaderId, false, cursor)
    engine.tick(state, cursor, 100, randomInt)
    cursor += 100
    if (cursor > now + engine.ROUND_MS + 1000) break
  }

  assert.equal(state.status, engine.STATUS.SETTLED)
  assert.equal(state.round.winner.userId, leaderId)
  assert.equal(state.round.placements[0].requestedPayout, 25)
})

test('serialize không lộ username', () => {
  const state = engine.createInitialState('session-1')
  engine.joinLobby(state, { _id: 'u1', username: 'secret', displayName: 'Lan', avatarId: 'fox' }, 1)
  const payload = engine.serializeState(state, 1)
  assert.equal(payload.lobby[0].displayName, 'Lan')
  assert.equal(Object.hasOwn(payload.lobby[0], 'username'), false)
})

test('admin fill bot đủ min players rồi countdown', () => {
  const state = engine.createInitialState('session-1')
  engine.joinLobby(state, user(1), 1000)
  const filled = engine.fillBots(state, 1000)
  assert.equal(filled.ok, true)
  assert.equal(state.lobby.length, engine.MIN_PLAYERS)
  assert.equal(state.lobby.filter((player) => player.isBot).length, engine.MIN_PLAYERS - 1)
  assert.equal(engine.maybeStartCountdown(state, 1000), true)
})
