const test = require('node:test')
const assert = require('node:assert/strict')
const core = require('../services/audition/rooms')

const user = (n) => ({ _id: `u${n}`, displayName: `P${n}` })
let tick = 0
const rng = () => ((tick++ * 0.618034) % 1)

const setup = (n = 2) => {
  const rooms = new Map()
  const room = core.createRoom(rooms, user(1), { name: 'Test' }, 0, rng)
  for (let i = 2; i <= n; i++) {
    core.joinRoom(rooms, room, user(i))
    core.setReady(room, `u${i}`, true)
  }
  return { rooms, room }
}

const turn = (room, userId, turnIndex, extra = {}) =>
  core.report(room, userId, { gameNo: room.gameNo, turnIndex, judgement: 'perfect', points: 300, combo: 1, level: 2, ...extra })

test('tạo phòng: người tạo là chủ phòng, mỗi người một nhân vật khác nhau', () => {
  const { room } = setup(3)
  assert.equal(room.hostId, 'u1')
  const chars = [...room.players.values()].map((p) => p.charId)
  assert.equal(new Set(chars).size, 3)
})

test('không vào được phòng đầy, phòng đang nhảy, hay khi đang ở phòng khác', () => {
  const { rooms, room } = setup(core.MAX_PLAYERS)
  assert.throws(() => core.joinRoom(rooms, room, user(99)), { code: 'ROOM_FULL' })
  const other = core.createRoom(rooms, user(50), {}, 0, rng)
  assert.throws(() => core.joinRoom(rooms, other, user(2)), { code: 'IN_OTHER_ROOM' })
  core.leaveRoom(rooms, room, 'u6')
  core.startGame(room, 'u1', 1000, rng)
  assert.throws(() => core.joinRoom(rooms, room, user(77)), { code: 'ROOM_PLAYING' })
})

test('chỉ chủ phòng bắt đầu được; bắt đầu thì phát seed và mốc giờ, xoá điểm ván trước', () => {
  const { room } = setup(2)
  assert.throws(() => core.startGame(room, 'u2', 0, rng), { code: 'NOT_HOST' })
  core.startGame(room, 'u1', 1000, rng)
  assert.equal(room.status, 'playing')
  assert.equal(room.startAt, 1000 + core.START_DELAY_MS)
  assert.ok(room.seed)
  turn(room, 'u2', 0)
  core.endGame(room)
  const firstSeed = room.seed
  core.setReady(room, 'u2', true) // ván mới phải sẵn sàng lại
  core.startGame(room, 'u1', 2000, rng)
  assert.equal(room.players.get('u2').score, 0)
  assert.equal(room.gameNo, 2)
  assert.notEqual(room.seed, firstSeed)
})

test('seed chỉ lộ khi đã bắt đầu', () => {
  const { room } = setup(1)
  assert.equal(core.serializeRoom(room).seed, null)
  core.startGame(room, 'u1', 0, rng)
  assert.equal(core.serializeRoom(room).seed, room.seed)
})

test('báo lượt: cộng điểm, chặn lượt cũ, điểm vô lý và ván cũ', () => {
  const { room } = setup(2)
  core.startGame(room, 'u1', 0, rng)
  const ev = turn(room, 'u2', 0, { showtime: true, turnLevel: 1 })
  assert.equal(ev.score, 300)
  assert.equal(ev.showtime, true)
  assert.throws(() => turn(room, 'u2', 0), { code: 'BAD_TURN' })
  assert.throws(() => turn(room, 'u2', 1, { points: core.MAX_TURN_POINTS + 1 }), { code: 'BAD_POINTS' })
  assert.throws(() => turn(room, 'u2', 1, { judgement: 'awesome' }), { code: 'BAD_JUDGEMENT' })
  assert.throws(() => turn(room, 'u2', 1, { gameNo: 99 }), { code: 'STALE_GAME' })
  turn(room, 'u2', 3, { judgement: 'missed', points: 0, combo: 0 })
  const p = room.players.get('u2')
  assert.equal(p.counts.missed, 1)
  assert.equal(p.maxCombo, 1)
})

test('ván kết thúc khi cả phòng báo xong, xếp hạng theo điểm', () => {
  const { room } = setup(2)
  core.startGame(room, 'u1', 0, rng)
  turn(room, 'u1', 0, { points: 100 })
  turn(room, 'u2', 0, { points: 900 })
  assert.equal(core.markDone(room, 'u1', room.gameNo), false)
  assert.equal(room.status, 'playing')
  assert.equal(core.markDone(room, 'u2', room.gameNo), true)
  assert.equal(room.status, 'finished')
  assert.deepEqual(room.results.map((r) => r.userId), ['u2', 'u1'])
})

test('quá giờ bài mà vẫn còn người chưa báo xong thì tự chốt ván', () => {
  const { room } = setup(2)
  core.startGame(room, 'u1', 0, rng)
  assert.equal(core.checkTimeout(room, room.startAt + core.SONG_MS), false)
  assert.equal(core.checkTimeout(room, room.startAt + core.SONG_MS + core.END_GRACE_MS + 1), true)
  assert.equal(room.status, 'finished')
})

test('chủ phòng rời thì chuyển chủ; người cuối rời thì xoá phòng', () => {
  const { rooms, room } = setup(2)
  core.leaveRoom(rooms, room, 'u1')
  assert.equal(room.hostId, 'u2')
  assert.equal(core.leaveRoom(rooms, room, 'u2'), true)
  assert.equal(rooms.has(room.id), false)
})

test('người cuối chưa xong mà rời phòng giữa bài thì ván vẫn chốt được', () => {
  const { rooms, room } = setup(2)
  core.startGame(room, 'u1', 0, rng)
  core.markDone(room, 'u1', room.gameNo)
  core.leaveRoom(rooms, room, 'u2')
  assert.equal(room.status, 'finished')
})

test('lịch lượt server khớp client: 76 lượt, tối đa 2 Finish Move mỗi người', () => {
  // client/src/utils/audition.test.js khẳng định cùng các con số này — sửa luật thì sửa cả hai
  assert.equal(core.CHART.turns.length, 76)
  assert.equal(core.CHART.maxFinishes, 2)
  assert.equal(core.CHART.turns[75].last, true)
})

test('bot: chủ phòng thêm/bớt được, tính vào giới hạn 6 người', () => {
  const { room } = setup(1)
  assert.throws(() => core.addBot(room, 'u2', {}, rng), { code: 'NOT_IN_ROOM' })
  for (let i = 0; i < core.MAX_PLAYERS - 1; i++) core.addBot(room, 'u1', {}, rng)
  assert.throws(() => core.addBot(room, 'u1', {}, rng), { code: 'ROOM_FULL' })
  const bot = [...room.players.values()].find((p) => p.isBot)
  core.removeBot(room, 'u1', bot.userId)
  assert.equal(room.players.size, core.MAX_PLAYERS - 1)
  assert.ok(core.serializeRoom(room).players.some((p) => p.isBot && p.skill))
})

test('bot tự chơi theo đồng hồ server, đúng luật level và khoá lượt sau Missed', () => {
  const { room } = setup(1)
  core.addBot(room, 'u1', { skill: 'newbie' }, rng)
  core.startGame(room, 'u1', 0, rng)
  const bot = [...room.players.values()].find((p) => p.isBot)
  assert.equal(core.botTick(room, room.startAt + 1000).events.length, 0) // chưa tới lượt nào
  const end = room.startAt + Math.ceil(core.CHART.endAt * 1000) + 10
  const { events } = core.botTick(room, end, Math.random)
  assert.ok(events.length > 15) // gà mờ hay Missed (khoá 3 ô từ level 6) nên số lượt báo cáo dao động
  assert.ok(events.every((e) => e.level >= 1 && e.level <= 9))
  // không lùi level trừ khi vừa qua Finish Move (về 6); Finish là lượt 9 phím có turnLevel bất kỳ
  for (let i = 1; i < events.length; i++) {
    if (events[i].level < events[i - 1].level) assert.equal(events[i].level, 6)
  }
  // Missed lượt thường: bị khoá 1 ô (dưới level 6) hoặc 3 ô (từ level 6) — không báo cáo trong các ô đó.
  // (Missed Finish Move không khoá, chỉ nghỉ 5 ô; lượt cuối bài luôn được đánh.)
  const lastIndex = core.CHART.turns.length - 1
  for (const e of events.filter((x) => x.judgement === 'missed' && !x.finish)) {
    const lock = e.turnLevel >= 6 ? 3 : 1
    for (let k = 1; k <= lock; k++) assert.ok(!events.some((x) => x.turnIndex === e.turnIndex + k && x.turnIndex !== lastIndex))
  }
  assert.equal(bot.done, true)
  core.markDone(room, 'u1', room.gameNo)
  assert.equal(room.status, 'finished')
})

test('người thật cuối cùng rời phòng thì giải tán dù còn bot', () => {
  const { rooms, room } = setup(1)
  core.addBot(room, 'u1', {}, rng)
  assert.equal(core.leaveRoom(rooms, room, 'u1'), true)
  assert.equal(rooms.has(room.id), false)
})

test('bot giỏi: đánh 3 lượt ở level 9 thì lượt kế là Finish, tối đa 2 lần, xong về level 6', () => {
  const chart = require('../services/audition/chart')
  const bot = chart.createBotState()
  const finishes = []
  for (const turn of core.CHART.turns) {
    const finish = chart.isFinishTurn(bot, turn, core.CHART.maxFinishes)
    const levelBefore = bot.level
    chart.applyResult(bot, finish, 'perfect')
    if (finish) {
      finishes.push(turn.index)
      assert.equal(levelBefore, 9)
      assert.equal(bot.level, 6)
    }
  }
  // lên 9 sau 8 lượt (0..7), đánh 3 lượt ở 9 (8..10) -> Finish ở lượt 11; về 6, leo 6→9 (12..14), 3 lượt ở 9 -> lượt 18
  assert.deepEqual(finishes, [11, 18])
})

test('bot chưa Finish lần nào thì lượt cuối bị ép thành Finish', () => {
  const chart = require('../services/audition/chart')
  const bot = chart.createBotState()
  const last = core.CHART.turns[core.CHART.turns.length - 1]
  assert.equal(chart.isFinishTurn(bot, last, core.CHART.maxFinishes), true)
  assert.equal(chart.isFinishTurn({ ...bot, finishTurns: 2 }, last, core.CHART.maxFinishes), false)
})

test('chủ phòng chỉ bắt đầu được khi mọi người đã sẵn sàng; hết ván phải sẵn sàng lại', () => {
  const rooms = new Map()
  const room = core.createRoom(rooms, user(1), {}, 0, rng)
  core.joinRoom(rooms, room, user(2))
  core.addBot(room, 'u1', {}, rng)
  assert.equal(core.serializeRoom(room).allReady, false)
  assert.throws(() => core.startGame(room, 'u1', 0, rng), { code: 'NOT_ALL_READY' })
  core.setReady(room, 'u2', true)
  // đã sẵn sàng thì khoá đổi nhân vật; chủ phòng vẫn đổi được
  assert.throws(() => core.setCharacter(room, 'u2', 'char_6'), { code: 'ALREADY_READY' })
  core.setCharacter(room, 'u1', 'char_6')
  core.startGame(room, 'u1', 0, rng)
  core.endGame(room)
  assert.equal(room.players.get('u2').ready, false)
  assert.throws(() => core.startGame(room, 'u1', 0, rng), { code: 'NOT_ALL_READY' })
})

test('chủ phòng chọn bài và sân khấu; giá trị lạ bị từ chối', () => {
  const { room } = setup(2)
  core.setSettings(room, 'u1', { songId: 'tttY', stageId: 'disco' })
  assert.equal(core.serializeRoom(room).stageId, 'disco')
  assert.throws(() => core.setSettings(room, 'u1', { songId: 'nope' }), { code: 'BAD_SONG' })
  assert.throws(() => core.setSettings(room, 'u1', { stageId: 'moon' }), { code: 'BAD_STAGE' })
  assert.throws(() => core.setSettings(room, 'u2', { stageId: 'neon' }), { code: 'NOT_HOST' })
})

test('mỗi bài có lịch lượt riêng; danh sách bài khớp client', () => {
  const chart = require('../services/audition/chart')
  const shape = Object.fromEntries(Object.values(chart.SONGS).map((s) => {
    const c = chart.createChart(s)
    return [s.id, [c.turns.length, c.maxFinishes]]
  }))
  // client/src/utils/audition.test.js kiểm cùng các con số này
  assert.deepEqual(shape, { tttY: [76, 2], chiLaAoGiac: [129, 3], khongTin: [75, 2], ngunger: [66, 2], aloha: [109, 2], thienDuong: [77, 2] })
})

test('chủ phòng không rời được khi đang nhảy; hết ván thì rời được', () => {
  const { rooms, room } = setup(2)
  core.startGame(room, 'u1', 0, rng)
  assert.throws(() => core.leaveRoom(rooms, room, 'u1'), { code: 'HOST_PLAYING' })
  core.leaveRoom(rooms, room, 'u2') // người thường vẫn rời được
  core.endGame(room)
  assert.equal(core.leaveRoom(rooms, room, 'u1'), true)
})

test('bảng điểm cuối bài có chuỗi Perfect liên tiếp dài nhất của từng người', () => {
  const { room } = setup(2)
  core.startGame(room, 'u1', 0, rng)
  const seq = ['perfect', 'perfect', 'great', 'perfect', 'perfect', 'perfect', 'missed', 'perfect']
  seq.forEach((judgement, i) => turn(room, 'u2', i * 2, { judgement, points: judgement === 'missed' ? 0 : 100 }))
  core.markDone(room, 'u1', room.gameNo)
  core.markDone(room, 'u2', room.gameNo)
  const r = room.results.find((x) => x.userId === 'u2')
  assert.equal(r.maxPerfect, 3)
  assert.deepEqual(r.counts, { perfect: 6, great: 1, cool: 0, bad: 0, missed: 1 })
  assert.equal(r.rank, 1)
})

test('chat: chỉ người trong phòng, cắt gọn, chặn spam, giữ lịch sử có hạn', () => {
  const { room } = setup(2)
  const msg = core.postChat(room, 'u2', '  chào   cả nhà  ', 1000)
  assert.deepEqual({ userId: msg.userId, name: msg.name, text: msg.text }, { userId: 'u2', name: 'P2', text: 'chào cả nhà' })
  assert.throws(() => core.postChat(room, 'u2', 'nữa', 1100), { code: 'CHAT_TOO_FAST' })
  assert.throws(() => core.postChat(room, 'u9', 'hi', 5000), { code: 'NOT_IN_ROOM' })
  assert.throws(() => core.postChat(room, 'u1', '   ', 5000), { code: 'EMPTY_MESSAGE' })
  assert.equal(core.postChat(room, 'u1', 'x'.repeat(500), 5000).text.length, core.CHAT_MAX_LEN)
  for (let i = 0; i < 60; i++) core.postChat(room, 'u1', `tin ${i}`, 10000 + i * 1000)
  const chat = core.serializeRoom(room).chat
  assert.equal(chat.length, 40)
  assert.equal(chat[chat.length - 1].text, 'tin 59')
  // vẫn chat được khi đang nhảy
  core.startGame(room, 'u1', 100000, rng)
  assert.equal(core.postChat(room, 'u2', 'gg', 200000).text, 'gg')
})

test('bot có 1 nhịp nhảy trước mọi lượt phím level 6+ (khớp luật client), Missed thì không nghỉ thêm', () => {
  const chart = require('../services/audition/chart')
  const bot = { ...chart.createBotState(), level: 6 }
  chart.applyResult(bot, false, 'perfect')
  assert.equal(bot.restLeft, 1)
  const up = { ...chart.createBotState(), level: 5 }
  chart.applyResult(up, false, 'perfect') // lên 6
  assert.equal(up.restLeft, 1)
  const low = { ...chart.createBotState(), level: 4 }
  chart.applyResult(low, false, 'perfect') // lên 5
  assert.equal(low.restLeft, 0)
  const missed = { ...chart.createBotState(), level: 8 }
  chart.applyResult(missed, false, 'missed')
  assert.deepEqual([missed.skipLeft, missed.restLeft], [3, 0]) // Missed từ level 6: chờ 3 ô
  const lowMiss = { ...chart.createBotState(), level: 3 }
  chart.applyResult(lowMiss, false, 'missed')
  assert.equal(lowMiss.skipLeft, 1)
  const fin = { ...chart.createBotState(), level: 9 }
  chart.applyResult(fin, true, 'great')
  assert.deepEqual([fin.restLeft, fin.level], [5, 6])
  // Missed lượt ngay trước Finish: mất Finish, chờ 7 ô, về level 6
  const pre = { ...chart.createBotState(), level: 9, turnsAt9: 2 }
  assert.equal(chart.isPreFinish(pre, false, 2), true)
  chart.applyResult(pre, false, 'missed', { preFinish: true })
  assert.deepEqual([pre.skipLeft, pre.finishTurns, pre.turnsAt9, pre.level], [7, 1, 0, 6])
  const finMiss = { ...chart.createBotState(), level: 9 }
  chart.applyResult(finMiss, true, 'missed')
  assert.deepEqual([finMiss.restLeft, finMiss.skipLeft, finMiss.level], [5, 0, 6])
})
