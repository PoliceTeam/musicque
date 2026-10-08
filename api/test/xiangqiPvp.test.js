const test = require('node:test')
const assert = require('node:assert/strict')
const Room = require('../models/xiangqiPvp.model')
const pvp = require('../services/xiangqiPvp.service')
const rules = require('../services/xiangqi/rules')
const id = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const red = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const black = 'cccccccccccccccccccccccc'
const outsider = 'dddddddddddddddddddddddd'
const initialFen = rules.createGame().fen()
const fixture = (extra = {}) => ({
  _id: id, code: '1234ABCD', red: { userId: red, username: 'Đỏ' },
  black: { userId: black, username: 'Đen' }, participants: [red, black],
  initialFen, currentFen: initialFen, moves: [], plyVersion: 1, status: 'playing', open: true,
  drawOfferedBy: null, stake: 0, funded: false, ...extra,
})
const rejects = (promise, text) => assert.rejects(promise, (error) => error instanceof pvp.PvpError && error.message.includes(text))

// Stub I/O để kiểm tra dịch vụ, luật cờ dùng engine thật.
const store = (t, room) => {
  t.mock.method(Room, 'findOne', async (query) => {
    if (query._id !== room._id || !room.participants.includes(query.participants)) return null
    return structuredClone(room)
  })
  t.mock.method(Room, 'findById', async () => structuredClone(room))
  t.mock.method(Room, 'findOneAndUpdate', async (query, patch) => {
    if (query.plyVersion !== undefined && query.plyVersion !== room.plyVersion || !room.open) return null
    Object.assign(room, patch.$set)
    room.plyVersion += patch.$inc.plyVersion
    if (patch.$push) room.moves.push(patch.$push.moves)
    return structuredClone(room)
  })
}

test('payload chỉ cho người đúng lượt danh sách nước hợp lệ', () => {
  const room = fixture()
  assert.equal(pvp.serialize(room, red).legalMoves.length, 44)
  assert.equal(pvp.serialize(room, black).legalMoves.length, 0)
  assert.equal(pvp.serialize(room, black).myColor, 'b')
  assert.equal(pvp.serialize(fixture({ status: 'waiting' }), red).legalMoves.length, 0)
})

test('chặn người ngoài, đi sai lượt, sai phiên bản và nước sai luật', async (t) => {
  store(t, fixture())
  await rejects(pvp.getGame(outsider, id), 'Không tìm thấy')
  await rejects(pvp.getGame(red, 'invalid'), 'Không tìm thấy')
  await rejects(pvp.playMove(black, id, { from: 'a9', to: 'a8', expectedPlyVersion: 1 }), 'Chưa tới lượt')
  await rejects(pvp.playMove(red, id, { from: 'a0', to: 'a1', expectedPlyVersion: 0 }), 'đã thay đổi')
  await rejects(pvp.playMove(red, id, { from: 'a0', to: 'a9', expectedPlyVersion: 1 }), 'không hợp lệ')
})

test('hai yêu cầu nước đi đồng thời chỉ chấp nhận một; đổi lượt sang Đen', async (t) => {
  const room = fixture()
  store(t, room)
  const results = await Promise.allSettled([1, 2].map(() => pvp.playMove(red, id, { from: 'a0', to: 'a1', expectedPlyVersion: 1 })))
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(room.moves.length, 1)
  assert.equal(pvp.serialize(room, black).turn, 'b')
  assert.ok(pvp.serialize(room, black).legalMoves.length > 0)
  const next = await pvp.playMove(black, id, { from: 'a9', to: 'a8', expectedPlyVersion: 2 })
  assert.equal(next.turn, 'r')
  assert.equal(room.moves.length, 2)
})

test('chỉ đối thủ được chấp nhận đề nghị hòa', async (t) => {
  const room = fixture()
  store(t, room)
  await pvp.action(red, id, { action: 'offer_draw', expectedPlyVersion: 1 })
  await rejects(pvp.action(red, id, { action: 'accept_draw', expectedPlyVersion: 2 }), 'không hợp lệ')
  const result = await pvp.action(black, id, { action: 'accept_draw', expectedPlyVersion: 2 })
  assert.equal(result.winner, 'draw')
  assert.equal(result.status, 'finished')
  assert.equal(room.open, false)
})

test('xin thua xác định đúng bên thắng; hủy phòng chờ', async (t) => {
  const room = fixture()
  store(t, room)
  assert.equal((await pvp.action(black, id, { action: 'resign', expectedPlyVersion: 1 })).winner, 'r')
  await rejects(pvp.playMove(red, id, { from: 'a0', to: 'a1', expectedPlyVersion: 2 }), 'đã kết thúc')
  Object.assign(room, fixture({ status: 'waiting', black: undefined, participants: [red] }))
  assert.equal((await pvp.action(red, id, { action: 'resign', expectedPlyVersion: 1 })).status, 'cancelled')
})

test('phục hồi lịch sử phát hiện hòa do lặp nước', () => {
  const room = fixture()
  for (let i = 0; i < 3; i++) room.moves.push(
    { from: 'b0', to: 'c2' }, { from: 'b9', to: 'c7' },
    { from: 'c2', to: 'b0' }, { from: 'c7', to: 'b9' },
  )
  assert.equal(pvp.positionOf(room).in_threefold_repetition(), true)
})
