const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../services/werewolf/engine')
const { ROLES, isWolfRole } = require('../services/werewolf/roles')

const seeded = (seed) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const user = (n) => ({ _id: `u${n}`, displayName: `P${n}` })

// Tạo ván đang ở đêm 1 với bộ vai cố định theo thứ tự u1..un
const setup = (roles, rng = seeded(1)) => {
  const state = engine.createInitialState()
  roles.forEach((_, index) => engine.joinLobby(state, user(index + 1), 0))
  const started = engine.startGame(state, { gameId: 'g1', now: 0, rng })
  assert.equal(started.ok, true)
  roles.forEach((role, index) => {
    const player = engine.findPlayer(state, `u${index + 1}`)
    player.role = role
    player.originalRole = role
    player.bullets = role === 'gunner' ? 2 : 0
  })
  return state
}

const act = (state, userId, targetId, extra = {}) => {
  const result = engine.submitAction(state, userId, { targetId, ...extra }, 1000, seeded(9))
  assert.equal(result.ok, true, result.message)
  return result
}

const endNight = (state, rng = seeded(3)) => engine.tick(state, state.phaseEndsAt, rng)
const p = (state, id) => engine.findPlayer(state, id)

test('chia vai luôn có sói, cân bằng và vai unique không trùng', () => {
  for (let n = 5; n <= 16; n += 1) {
    let fallbacks = 0
    for (let seed = 1; seed <= 150; seed += 1) {
      const { roles, attempts } = engine.buildRoles(n, seeded(seed * 97 + n))
      assert.equal(roles.length, n)
      assert.ok(roles.some(isWolfRole), `n=${n} không có sói`)
      if (attempts === -1) fallbacks += 1
      else assert.ok(engine.isBalanced(roles))
      Object.entries(ROLES).filter(([, def]) => def.unique).forEach(([key]) => {
        assert.ok(roles.filter((role) => role === key).length <= 1, `${key} bị trùng`)
      })
    }
    assert.ok(fallbacks <= 3, `n=${n} fallback ${fallbacks} lần`)
  }
})

test('cần đủ người mới bắt đầu, chỉ host được bắt đầu sớm', () => {
  const state = engine.createInitialState()
  for (let i = 1; i < engine.CONFIG.MIN_PLAYERS; i += 1) engine.joinLobby(state, user(i), 0)
  assert.equal(engine.startGame(state, { now: 0, rng: seeded(1) }).code, 'NOT_ENOUGH_PLAYERS')
  engine.joinLobby(state, user(99), 0)
  assert.ok(state.autoStartAt > 0)
  assert.equal(engine.startGame(state, { now: 0, rng: seeded(1), byUserId: 'u2' }).code, 'NOT_HOST')
  assert.equal(engine.startGame(state, { now: 0, rng: seeded(1), byUserId: 'u1' }).ok, true)
  assert.equal(state.phase, engine.PHASE.NIGHT)
  assert.equal(engine.joinLobby(state, user(100), 0).code, 'GAME_RUNNING')
})

test('sói ăn thịt, thiên thần chặn được', () => {
  const state = setup(['wolf', 'guardian', 'seer', 'villager', 'villager'])
  act(state, 'u1', 'u3')
  act(state, 'u2', 'u3')
  act(state, 'u3', 'u1')
  endNight(state)
  assert.equal(p(state, 'u3').alive, true)
  assert.equal(state.phase, engine.PHASE.DAY)
  const seerView = engine.serializeFor(state, 'u3', 2000)
  assert.ok(seerView.log.some((entry) => entry.text.includes('P1 là 🐺 Ma sói')))
})

test('bật công bố vai: nạn nhân chết thì cả làng thấy vai', () => {
  const state = setup(['wolf', 'villager', 'seer', 'villager', 'villager'])
  state.revealRoleOnDeath = true
  act(state, 'u1', 'u3')
  endNight(state)
  assert.equal(p(state, 'u3').alive, false)
  const view = engine.serializeFor(state, 'u2', 2000)
  assert.equal(view.players.find((x) => x.userId === 'u3').role, 'seer')
})

test('kẻ bị nguyền bị cắn thì hoá sói thay vì chết', () => {
  const state = setup(['wolf', 'cursed', 'villager', 'villager', 'villager'])
  act(state, 'u1', 'u2')
  endNight(state)
  assert.equal(p(state, 'u2').alive, true)
  assert.equal(p(state, 'u2').role, 'wolf')
  assert.equal(p(state, 'u2').originalRole, 'cursed')
})

test('ăn phải bợm nhậu thì bầy sói nghỉ săn đêm kế', () => {
  const state = setup(['wolf', 'drunk', 'villager', 'villager', 'villager', 'villager', 'villager'])
  act(state, 'u1', 'u2')
  endNight(state)
  assert.equal(p(state, 'u2').alive, false)
  engine.tick(state, state.phaseEndsAt, seeded(2)) // hết ngày → bỏ phiếu
  engine.tick(state, state.phaseEndsAt, seeded(2)) // không ai bầu → đêm 2
  assert.equal(state.phase, engine.PHASE.NIGHT)
  assert.equal(engine.availableAction(state, p(state, 'u1')).kind, 'none')
  endNight(state)
  assert.equal(state.players.filter((x) => !x.alive).length, 1)
})

test('treo cổ kẻ chán đời thì kẻ chán đời thắng', () => {
  const state = setup(['wolf', 'tanner', 'villager', 'villager', 'villager', 'villager'])
  endNight(state)
  engine.tick(state, state.phaseEndsAt, seeded(2))
  ;['u1', 'u3', 'u4', 'u5', 'u6'].forEach((id) => act(state, id, 'u2'))
  engine.tick(state, state.phaseEndsAt, seeded(2))
  assert.equal(state.status, engine.STATUS.ENDED)
  assert.equal(state.result.team, 'tanner')
  assert.deepEqual(state.result.winners, ['u2'])
})

test('hoà phiếu thì không ai bị treo', () => {
  const state = setup(['wolf', 'villager', 'villager', 'villager', 'villager', 'villager'])
  endNight(state)
  engine.tick(state, state.phaseEndsAt, seeded(2))
  act(state, 'u2', 'u1')
  act(state, 'u3', 'u4')
  engine.tick(state, state.phaseEndsAt, seeded(2))
  assert.equal(state.players.filter((x) => !x.alive).length, 0)
  assert.equal(state.phase, engine.PHASE.NIGHT)
})

test('người yêu chết thì người kia chết theo', () => {
  const state = setup(['wolf', 'cupid', 'villager', 'villager', 'villager', 'villager', 'villager'])
  act(state, 'u2', 'u3', { targetId2: 'u4' })
  act(state, 'u1', 'u3')
  endNight(state)
  assert.equal(p(state, 'u3').alive, false)
  assert.equal(p(state, 'u4').alive, false)
  assert.equal(p(state, 'u4').death.cause, 'heartbreak')
})

test('thợ săn bị treo cổ được bắn một người', () => {
  const state = setup(['wolf', 'hunter', 'villager', 'villager', 'villager', 'villager', 'villager'])
  endNight(state)
  engine.tick(state, state.phaseEndsAt, seeded(2))
  ;['u3', 'u4', 'u5'].forEach((id) => act(state, id, 'u2'))
  engine.tick(state, state.phaseEndsAt, seeded(2))
  assert.equal(state.phase, engine.PHASE.HUNTER)
  assert.equal(engine.availableAction(state, p(state, 'u2')).kind, 'hunter_shot')
  const result = act(state, 'u2', 'u1')
  assert.ok(result.events.includes('ended'))
  assert.equal(state.result.team, 'village')
})

test('xạ thủ nổ súng thì lộ vai, mỗi ngày một phát', () => {
  const state = setup(['wolf', 'gunner', 'villager', 'villager', 'villager', 'villager', 'villager'])
  endNight(state)
  act(state, 'u2', 'u3')
  assert.equal(p(state, 'u3').alive, false)
  assert.equal(p(state, 'u2').bullets, 1)
  assert.equal(engine.availableAction(state, p(state, 'u2')), null)
  const view = engine.serializeFor(state, 'u4', 2000)
  assert.equal(view.players.find((x) => x.userId === 'u2').role, 'gunner')
})

test('sói con chết thì đêm sau bầy sói giết hai người', () => {
  const state = setup(['wolf', 'wolf_cub', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager'])
  endNight(state)
  engine.tick(state, state.phaseEndsAt, seeded(2))
  ;['u3', 'u4', 'u5', 'u6'].forEach((id) => act(state, id, 'u2'))
  engine.tick(state, state.phaseEndsAt, seeded(2))
  assert.equal(state.phase, engine.PHASE.NIGHT)
  const action = engine.availableAction(state, p(state, 'u1'))
  assert.equal(action.needsTwo, true)
  act(state, 'u1', 'u3', { targetId2: 'u4' })
  endNight(state)
  assert.equal(p(state, 'u3').alive, false)
  assert.equal(p(state, 'u4').alive, false)
})

test('sói còn bằng số dân thì sói thắng', () => {
  const state = setup(['wolf', 'villager', 'villager'].concat(['villager', 'villager']))
  p(state, 'u3').alive = false
  p(state, 'u4').alive = false
  act(state, 'u1', 'u2')
  endNight(state)
  assert.equal(state.status, engine.STATUS.ENDED)
  assert.equal(state.result.team, 'wolf')
})

test('không lộ vai hay hành động của người khác', () => {
  const state = setup(['wolf', 'wolf', 'seer', 'villager', 'villager', 'villager', 'villager', 'villager'])
  act(state, 'u1', 'u4')
  act(state, 'u3', 'u1')
  const villager = engine.serializeFor(state, 'u5', 1000)
  assert.deepEqual(villager.players.filter((x) => x.role).map((x) => x.userId), ['u5'])
  assert.equal(villager.me.wolfVotes, null)
  assert.ok(villager.log.every((entry) => entry.channel === 'public' || entry.to?.includes('u5')))

  const wolf = engine.serializeFor(state, 'u2', 1000)
  assert.deepEqual(wolf.players.filter((x) => x.role).map((x) => x.userId).sort(), ['u1', 'u2'])
  assert.equal(wolf.me.wolfVotes.find((v) => v.userId === 'u1').targetId, 'u4')

  const guest = engine.serializeFor(state, null, 1000)
  assert.equal(guest.me, null)
  assert.ok(guest.players.every((x) => x.role === null))
})

test('chat: đêm chỉ sói nói được, người chết nói kênh riêng', () => {
  const state = setup(['wolf', 'villager', 'villager', 'villager', 'villager'])
  assert.equal(engine.chat(state, 'u2', 'alo', 1000).code, 'NIGHT_SILENT')
  assert.equal(engine.chat(state, 'u1', 'ăn ai?', 1000).channel, 'wolves')
  act(state, 'u1', 'u2')
  endNight(state)
  assert.equal(engine.chat(state, 'u2', 'tôi chết rồi', 70_000).channel, 'dead')
  assert.equal(engine.chat(state, 'u3', 'ai là sói?', 70_000).channel, 'public')
  assert.equal(engine.chat(state, 'u404', 'xem thôi', 70_000).code, 'SPECTATOR')
})

test('mô phỏng toàn bot: ván nào cũng kết thúc hợp lệ', () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    const rng = seeded(seed)
    const state = engine.createInitialState()
    engine.joinLobby(state, user(0), 0)
    const n = 5 + (seed % 12)
    engine.fillBots(state, 0, n)
    engine.startGame(state, { gameId: `g${seed}`, now: 0, rng })
    // Người thật u0 để máy tự chọn giống bot
    engine.findPlayer(state, 'u0').isBot = true
    let now = 0
    let guard = 0
    while (state.status === engine.STATUS.PLAYING && guard < 400) {
      now = state.phaseEndsAt
      engine.tick(state, now, rng)
      guard += 1
    }
    assert.equal(state.status, engine.STATUS.ENDED, `seed ${seed} không kết thúc`)
    assert.ok(state.result.team)
    state.result.winners.forEach((id) => assert.ok(engine.findPlayer(state, id)))
  }
})

test('admin chỉnh thời gian: áp dụng cho pha sau, chặn giá trị ngoài khoảng', () => {
  const defaults = engine.getTimings()
  try {
    assert.equal(engine.applySettings({ nightMs: 1000 }).ok, false)
    assert.equal(engine.getTimings().nightMs, defaults.nightMs)
    assert.equal(engine.applySettings({ nightMs: 30_000, voteMs: 20_000 }).ok, true)
    const state = setup(['wolf', 'villager', 'villager', 'villager', 'villager'])
    assert.equal(state.phaseEndsAt - state.phaseStartedAt, 30_000)
    assert.equal(engine.getTimings().dayMs, defaults.dayMs)
    engine.applySettings({ voteMs: 25_000 })
    assert.equal(engine.getTimings().nightMs, defaults.nightMs, 'field thiếu phải về mặc định')
  } finally {
    engine.applySettings(defaults)
  }
})

test('đêm đầu có thần tình yêu thì dài hơn, các đêm sau về bình thường', () => {
  // Thử seed tới khi bộ vai có cupid
  let seed = 1
  let game
  do {
    game = engine.createInitialState()
    for (let i = 1; i <= 7; i += 1) engine.joinLobby(game, user(i), 0)
    engine.startGame(game, { now: 0, rng: seeded(seed) })
    seed += 1
  } while (!game.players.some((x) => x.role === 'cupid'))
  assert.equal(game.phaseEndsAt - game.phaseStartedAt, engine.CONFIG.CUPID_NIGHT_MS)
  const normal = setup(['wolf', 'villager', 'villager', 'villager', 'villager'])
  assert.equal(normal.phaseEndsAt - normal.phaseStartedAt, engine.CONFIG.NIGHT_MS)
})

test('mặc định giấu vai người chết tới hết ván, kể cả nguyên nhân chết', () => {
  assert.equal(engine.CONFIG.REVEAL_ROLE_ON_DEATH, false)
  const state = setup(['wolf', 'guardian', 'seer', 'villager', 'villager', 'villager', 'villager'])
  act(state, 'u2', 'u1') // thiên thần canh nhà sói
  act(state, 'u1', 'u3')
  endNight(state, () => 0) // rng=0 → thiên thần chắc chắn bị ăn
  assert.equal(p(state, 'u2').alive, false)
  assert.equal(p(state, 'u2').death.cause, 'guard_wolf')
  const view = engine.serializeFor(state, 'u4', 2000)
  const dead = view.players.filter((x) => !x.alive)
  assert.ok(dead.length >= 2)
  dead.forEach((x) => {
    assert.equal(x.role, null)
    assert.equal(x.death.cause, 'night')
  })
  const publicText = view.log.filter((e) => e.channel === 'public').map((e) => e.text).join('\n')
  Object.values(ROLES).forEach((role) => assert.ok(!publicText.includes(`${role.emoji} ${role.name}`), `lộ ${role.name}`))
  assert.ok(!publicText.includes('canh nhầm'), 'nguyên nhân chết lộ vai thiên thần')
  // Người chết vẫn thấy vai của chính mình
  assert.equal(engine.serializeFor(state, 'u2', 2000).me.role, 'guardian')
})

test('giấu vai nhưng thợ săn nổ súng thì lộ là thợ săn', () => {
  const state = setup(['wolf', 'hunter', 'villager', 'villager', 'villager', 'villager', 'villager'])
  endNight(state)
  engine.tick(state, state.phaseEndsAt, seeded(2))
  ;['u3', 'u4', 'u5'].forEach((id) => act(state, id, 'u2'))
  engine.tick(state, state.phaseEndsAt, seeded(2))
  const view = engine.serializeFor(state, 'u6', 2000)
  assert.equal(view.players.find((x) => x.userId === 'u2').role, 'hunter')
})

test('công tắc chốt theo ván: đổi giữa chừng không lật vai người đã chết', () => {
  try {
    const state = setup(['wolf', 'villager', 'seer', 'villager', 'villager'])
    act(state, 'u1', 'u3')
    endNight(state)
    assert.equal(engine.applySettings({ revealRoleOnDeath: true }).ok, true)
    const view = engine.serializeFor(state, 'u2', 2000)
    assert.equal(view.players.find((x) => x.userId === 'u3').role, null)
    assert.equal(view.config.revealRoleOnDeath, false)
    assert.equal(engine.applySettings({ revealRoleOnDeath: 'yes' }).ok, false)
  } finally {
    engine.applySettings({})
  }
})
