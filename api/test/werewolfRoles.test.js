const test = require('node:test')
const assert = require('node:assert/strict')
const engine = require('../services/werewolf/engine')

const seeded = (seed) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const always = (value) => () => value

const user = (n) => ({ _id: `u${n}`, displayName: `P${n}` })

// Ván đang ở đêm 1 với bộ vai cố định theo thứ tự u1..un (không dính lựa chọn đêm đầu ngẫu nhiên)
const setup = (roles) => {
  const state = engine.createInitialState()
  roles.forEach((_, index) => engine.joinLobby(state, user(index + 1), 0))
  engine.startGame(state, { gameId: 'g', now: 0, rng: seeded(1) })
  state.log = []
  roles.forEach((role, index) => {
    const player = engine.findPlayer(state, `u${index + 1}`)
    Object.assign(player, { role, originalRole: role, bullets: role === 'gunner' ? 2 : 0, loverId: null, modelId: null, stole: false, cultJoinedAt: role === 'cultist' ? index + 1 : null })
  })
  state.day = 1
  return state
}

const p = (state, id) => engine.findPlayer(state, id)
const act = (state, userId, targetId, extra = {}) => {
  const result = engine.submitAction(state, userId, { targetId, ...extra }, state.phaseStartedAt + 1, seeded(9))
  assert.equal(result.ok, true, `${userId}: ${result.message}`)
  return result
}
const endPhase = (state, rng = seeded(3)) => engine.tick(state, state.phaseEndsAt, rng)
// Từ ngày hiện tại đi thẳng tới đêm kế tiếp (không ai bầu ai)
const skipToNextNight = (state) => {
  const day = state.day
  while (!(state.phase === engine.PHASE.NIGHT && state.day > day)) endPhase(state)
}
const privateTo = (state, id) => state.log.filter((e) => e.channel === 'private' && e.to.includes(id)).map((e) => e.text)
const lastPrivate = (state, id) => privateTo(state, id).at(-1) || ''
const publicText = (state) => state.log.filter((e) => e.channel === 'public').map((e) => e.text).join('\n')
const VILLAGERS = (n) => Array(n).fill('villager')

test('Trưởng làng công khai thì phiếu tính gấp đôi', () => {
  const state = setup(['wolf', 'mayor', ...VILLAGERS(5)])
  endPhase(state)
  act(state, 'u2', null, { kind: 'mayor_reveal' })
  assert.equal(p(state, 'u2').revealed, true)
  endPhase(state)
  act(state, 'u2', 'u1')
  act(state, 'u3', 'u4')
  endPhase(state)
  assert.equal(p(state, 'u1').alive, false, 'phiếu x2 của trưởng làng phải thắng 2–1')
  assert.equal(engine.submitAction(state, 'u2', { kind: 'mayor_reveal' }, 0, seeded(1)).ok, false)
})

test('Hoàng tử thoát treo cổ lần đầu, lần hai thì chết', () => {
  const state = setup(['wolf', 'prince', ...VILLAGERS(5)])
  endPhase(state)
  endPhase(state)
  ;['u3', 'u4', 'u5'].forEach((id) => act(state, id, 'u2'))
  endPhase(state)
  assert.equal(p(state, 'u2').alive, true)
  assert.equal(p(state, 'u2').revealed, true)
  endPhase(state)
  endPhase(state)
  ;['u3', 'u4', 'u5'].forEach((id) => act(state, id, 'u2'))
  endPhase(state)
  assert.equal(p(state, 'u2').alive, false)
})

test('Già làng chịu được một lần sói cắn; xạ thủ giết già làng thì mất súng', () => {
  const state = setup(['wolf', 'wise_elder', 'gunner', ...VILLAGERS(4)])
  act(state, 'u1', 'u2')
  endPhase(state, always(0.99))
  assert.equal(p(state, 'u2').alive, true)
  assert.equal(p(state, 'u2').hasUsedAbility, true)
  act(state, 'u3', 'u2')
  assert.equal(p(state, 'u2').alive, false)
  assert.equal(p(state, 'u3').role, 'villager')
  assert.equal(p(state, 'u3').bullets, 0)
})

test('Hội kín thấy nhau, người khác không thấy', () => {
  const state = setup(['wolf', 'mason', 'mason', ...VILLAGERS(4)])
  const mason = engine.serializeFor(state, 'u2', 1)
  assert.deepEqual(mason.players.filter((x) => x.role).map((x) => x.userId).sort(), ['u2', 'u3'])
  const villager = engine.serializeFor(state, 'u4', 1)
  assert.deepEqual(villager.players.filter((x) => x.role).map((x) => x.userId), ['u4'])
})

test('Tiên tri tập sự lên thay khi Tiên tri chết', () => {
  const state = setup(['wolf', 'seer', 'apprentice_seer', 'beholder', ...VILLAGERS(3)])
  act(state, 'u1', 'u2')
  endPhase(state, always(0.99))
  assert.equal(p(state, 'u3').role, 'seer')
  assert.match(lastPrivate(state, 'u4'), /Tiên tri mới: P3/)
})

test('Kẻ phản bội hoá sói khi bầy chết hết; Sói đội lốt hiện ra là dân', () => {
  const state = setup(['lycan', 'seer', 'traitor', ...VILLAGERS(4)])
  act(state, 'u2', 'u1')
  endPhase(state, always(0.99))
  assert.match(lastPrivate(state, 'u2'), /P1 là 👱 Dân làng/)
  endPhase(state)
  ;['u2', 'u4', 'u5', 'u6'].forEach((id) => act(state, id, 'u1'))
  endPhase(state)
  assert.equal(p(state, 'u1').alive, false)
  assert.equal(p(state, 'u3').role, 'wolf')
  assert.equal(state.status, engine.STATUS.PLAYING)
})

test('Kẻ khờ tưởng mình là Tiên tri và soi ra vai ngẫu nhiên', () => {
  const state = setup(['wolf', 'fool', ...VILLAGERS(5)])
  const view = engine.serializeFor(state, 'u2', 1)
  assert.equal(view.me.role, 'seer')
  assert.equal(view.players.find((x) => x.userId === 'u2').role, 'seer')
  assert.equal(view.me.action.kind, 'see')
  act(state, 'u2', 'u1')
  endPhase(state, always(0.99))
  assert.match(lastPrivate(state, 'u2'), /P1 là 👱 Dân làng/, 'rng cao → bốc trúng một dân làng thay vì vai thật')
})

test('Người đi đêm: vắng nhà thì thoát sói, vào nhà sói hoặc nhà nạn nhân thì chết', () => {
  let state = setup(['wolf', 'harlot', ...VILLAGERS(5)])
  act(state, 'u2', 'u3')
  act(state, 'u1', 'u2')
  endPhase(state, always(0.99))
  assert.equal(p(state, 'u2').alive, true)
  assert.match(lastPrivate(state, 'u2'), /không phải sói/)

  state = setup(['wolf', 'harlot', ...VILLAGERS(5)])
  act(state, 'u2', 'u1')
  endPhase(state, always(0.99))
  assert.equal(p(state, 'u2').alive, false)

  state = setup(['wolf', 'harlot', ...VILLAGERS(5)])
  act(state, 'u2', 'u3')
  act(state, 'u1', 'u3')
  endPhase(state, always(0.99))
  assert.equal(p(state, 'u3').alive, false)
  assert.equal(p(state, 'u2').death.cause, 'harlot_victim')
})

test('Thám tử biết vai thật cuối ngày và có thể bị sói phát hiện', () => {
  const state = setup(['lycan', 'detective', ...VILLAGERS(5)])
  endPhase(state)
  act(state, 'u2', 'u1')
  endPhase(state, always(0.1))
  assert.match(lastPrivate(state, 'u2'), /P1 là 🌝 Sói đội lốt/)
  assert.ok(state.log.some((e) => e.channel === 'wolves' && e.text.includes('P2 là Thám tử')))
})

test('Thợ rèn rải bạc: đêm sau bầy sói không ra tay', () => {
  const state = setup(['wolf', 'blacksmith', ...VILLAGERS(5)])
  endPhase(state)
  act(state, 'u2', null, { kind: 'spread_silver' })
  endPhase(state)
  endPhase(state)
  assert.equal(state.phase, engine.PHASE.NIGHT)
  assert.equal(engine.availableAction(state, p(state, 'u1')).kind, 'none')
  endPhase(state)
  assert.equal(state.players.filter((x) => !x.alive).length, 0)
})

test('Thần ngủ: đêm sau không ai làm được gì, cả làng sống', () => {
  const state = setup(['wolf', 'sandman', 'seer', ...VILLAGERS(4)])
  endPhase(state)
  act(state, 'u2', null, { kind: 'sandman_sleep' })
  endPhase(state)
  endPhase(state)
  assert.equal(state.sleeping, true)
  assert.equal(engine.availableAction(state, p(state, 'u1')).kind, 'none')
  assert.equal(engine.availableAction(state, p(state, 'u3')).kind, 'none')
  endPhase(state)
  assert.equal(state.players.filter((x) => !x.alive).length, 0)
  assert.equal(state.phase, engine.PHASE.DAY)
})

test('Pháp sư soi ra sói/tiên tri, bầy không biết pháp sư, thắng cùng sói', () => {
  const state = setup(['wolf', 'sorcerer', 'seer', ...VILLAGERS(2)])
  act(state, 'u2', 'u3')
  act(state, 'u1', 'u4')
  endPhase(state, always(0.99))
  assert.match(lastPrivate(state, 'u2'), /P3 là 👳 Tiên tri/)
  const wolfView = engine.serializeFor(state, 'u1', 1)
  assert.equal(wolfView.players.find((x) => x.userId === 'u2').role, null)
  p(state, 'u3').alive = false
  p(state, 'u5').alive = false
  const winner = engine.checkWinner(state, seeded(1), 0)
  assert.equal(winner.team, 'wolf')
})

test('Nhà tiên đoán nói một vai mà mục tiêu KHÔNG phải; Thầy bói nói một vai không có trong làng', () => {
  const state = setup(['wolf', 'oracle', 'augur', 'seer', 'villager', 'villager'])
  act(state, 'u2', 'u1')
  endPhase(state, always(0.5))
  const oracleMsg = lastPrivate(state, 'u2')
  assert.match(oracleMsg, /P1 KHÔNG phải là/)
  assert.ok(!oracleMsg.includes('Ma sói'))
  const augurMsg = lastPrivate(state, 'u3')
  const present = ['Ma sói', 'Nhà tiên đoán', 'Thầy bói chim', 'Tiên tri', 'Dân làng']
  assert.match(augurMsg, /không có/)
  present.forEach((name) => assert.ok(!augurMsg.includes(` ${name}.`), `thầy bói nói nhầm vai đang có: ${augurMsg}`))
})

test('Đứa trẻ hoang hoá sói khi hình mẫu chết; Kẻ bắt chước nhận vai hình mẫu', () => {
  const state = setup(['wolf', 'wild_child', 'doppelganger', 'seer', ...VILLAGERS(3)])
  act(state, 'u2', 'u4')
  act(state, 'u3', 'u4')
  act(state, 'u1', 'u4')
  endPhase(state, always(0.99))
  assert.equal(p(state, 'u4').alive, false)
  assert.equal(p(state, 'u2').role, 'wolf')
  assert.equal(p(state, 'u3').role, 'seer')
})

test('Kẻ trộm lấy vai sói: kẻ trộm thành sói, nạn nhân thành dân', () => {
  const state = setup(['wolf', 'thief', ...VILLAGERS(5)])
  act(state, 'u2', 'u1')
  endPhase(state, always(0.99))
  assert.equal(p(state, 'u2').role, 'wolf')
  assert.equal(p(state, 'u1').role, 'villager')
  assert.equal(p(state, 'u2').stole, true)
})

test('Sói tuyết đóng băng làm mất kỹ năng đêm đó, được miễn đêm sau', () => {
  const state = setup(['wolf', 'snow_wolf', 'seer', ...VILLAGERS(4)])
  act(state, 'u2', 'u3')
  act(state, 'u3', 'u1')
  endPhase(state, always(0.99))
  assert.ok(!privateTo(state, 'u3').some((t) => t.includes('Quả cầu')), 'tiên tri bị đóng băng không được soi')
  skipToNextNight(state)
  const freeze = engine.availableAction(state, p(state, 'u2'))
  assert.ok(!freeze.targets.includes('u3'), 'người vừa bị đóng băng được miễn đêm sau')
})

test('Tà giáo chiêu mộ, Thợ săn tà giáo hạ tín đồ, tín đồ gõ cửa thợ săn thì chết', () => {
  let state = setup(['wolf', 'cultist', 'cult_hunter', ...VILLAGERS(8)])
  act(state, 'u2', 'u4')
  endPhase(state, always(0.99))
  assert.equal(p(state, 'u4').role, 'cultist')
  const cultView = engine.serializeFor(state, 'u2', 1)
  assert.deepEqual(cultView.players.filter((x) => x.role === 'cultist').map((x) => x.userId).sort(), ['u2', 'u4'])

  state = setup(['wolf', 'cultist', 'cult_hunter', ...VILLAGERS(8)])
  act(state, 'u3', 'u2')
  endPhase(state, always(0.99))
  assert.equal(p(state, 'u2').alive, false)

  state = setup(['wolf', 'cultist', 'cult_hunter', ...VILLAGERS(8)])
  act(state, 'u2', 'u3')
  endPhase(state, always(0.99))
  assert.equal(p(state, 'u2').alive, false)
  assert.equal(p(state, 'u3').role, 'cult_hunter')
})

test('Tà giáo thắng khi mọi người còn sống đều là tín đồ', () => {
  const state = setup(['wolf', 'cultist', 'cultist', 'villager', 'villager'])
  p(state, 'u1').alive = false
  p(state, 'u4').alive = false
  p(state, 'u5').alive = false
  assert.equal(engine.checkWinner(state, seeded(1), 0).team, 'cult')
})

test('Kẻ phóng hoả: tưới xăng rồi châm lửa, thiên thần cứu được nhà đang canh', () => {
  const state = setup(['wolf', 'arsonist', 'guardian', ...VILLAGERS(5)])
  act(state, 'u2', 'u4')
  endPhase(state, always(0.99))
  skipToNextNight(state)
  act(state, 'u2', 'u5')
  endPhase(state, always(0.99))
  skipToNextNight(state)
  const action = engine.availableAction(state, p(state, 'u2'))
  assert.equal(action.extra.targetId, engine.SPARK)
  act(state, 'u3', 'u5')
  act(state, 'u2', engine.SPARK)
  endPhase(state, always(0.99))
  assert.equal(p(state, 'u4').alive, false)
  assert.equal(p(state, 'u4').death.cause, 'burned')
  assert.equal(p(state, 'u5').alive, true)
})

test('Kẻ phóng hoả thắng khi chỉ còn một người và không ai có đạn', () => {
  const state = setup(['wolf', 'arsonist', 'villager', 'villager', 'villager'])
  ;['u1', 'u4', 'u5'].forEach((id) => { p(state, id).alive = false })
  assert.equal(engine.checkWinner(state, seeded(1), 0).team, 'arsonist')
})

test('Kênh chat đêm: sói nói kênh sói, tín đồ nói kênh tà giáo, không lọt sang nhau', () => {
  const state = setup(['wolf', 'cultist', 'cult_hunter', ...VILLAGERS(8)])
  assert.equal(engine.chat(state, 'u1', 'ăn ai?', 5000).channel, 'wolves')
  assert.equal(engine.chat(state, 'u2', 'rủ ai?', 5000).channel, 'cult')
  assert.equal(engine.chat(state, 'u3', 'alo', 5000).code, 'NIGHT_SILENT')
  const wolfLog = engine.serializeFor(state, 'u1', 5000).log.map((e) => e.channel)
  const cultLog = engine.serializeFor(state, 'u2', 5000).log.map((e) => e.channel)
  assert.ok(!wolfLog.includes('cult'))
  assert.ok(!cultLog.includes('wolves'))
})

test('Mô phỏng toàn bot với đủ 36 vai: mọi ván đều kết thúc, không lỗi', () => {
  const seen = new Set()
  const teams = {}
  for (let seed = 1; seed <= 600; seed += 1) {
    const rng = seeded(seed * 7)
    const state = engine.createInitialState()
    engine.joinLobby(state, user(0), 0)
    engine.fillBots(state, 0, 5 + (seed % 12))
    engine.startGame(state, { gameId: `g${seed}`, now: 0, rng })
    engine.findPlayer(state, 'u0').isBot = true
    state.players.forEach((x) => seen.add(x.role))
    let guard = 0
    while (state.status === engine.STATUS.PLAYING && guard < 500) {
      // Bot tự chơi cả kỹ năng ban ngày (xạ thủ, thám tử…) qua autoActBots ở đầu mỗi pha
      engine.tick(state, state.phaseEndsAt, rng)
      guard += 1
    }
    assert.equal(state.status, engine.STATUS.ENDED, `seed ${seed} không kết thúc (pha ${state.phase}, ngày ${state.day})`)
    teams[state.result.team] = (teams[state.result.team] || 0) + 1
    state.result.winners.forEach((id) => assert.ok(engine.findPlayer(state, id)))
  }
  const missing = ['mayor', 'prince', 'wise_elder', 'mason', 'apprentice_seer', 'traitor', 'lycan', 'fool', 'harlot', 'detective', 'blacksmith', 'sandman', 'sorcerer', 'beholder', 'oracle', 'augur', 'wild_child', 'doppelganger', 'thief', 'snow_wolf', 'cultist', 'cult_hunter', 'arsonist'].filter((r) => !seen.has(r))
  assert.deepEqual(missing, [], 'vai nào cũng phải xuất hiện trong mô phỏng')
  assert.ok(Object.keys(teams).length >= 5, `quá ít phe từng thắng: ${JSON.stringify(teams)}`)
})
