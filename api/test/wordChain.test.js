const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizePhrase, splitPhrase, isValidTwoSyllablePhrase } = require('../services/wordChain/normalization')
const wordChain = require('../services/wordChain.service')
const catalog = require('../data/wordchain/catalog.json')

test('chuẩn hóa cụm từ tiếng Việt trước khi tra từ điển', () => {
  assert.equal(normalizePhrase('  Thể   Thao  '), 'thể thao')
  assert.deepEqual(splitPhrase('Thao Tác'), ['thao', 'tác'])
})

test('chỉ nhận cụm hai tiếng có ký tự tiếng Việt', () => {
  assert.equal(isValidTwoSyllablePhrase('thao tác'), true)
  assert.equal(isValidTwoSyllablePhrase('thao mao'), true)
  assert.equal(isValidTwoSyllablePhrase('thể'), false)
  assert.equal(isValidTwoSyllablePhrase('thể thao vui'), false)
  assert.equal(isValidTwoSyllablePhrase('thể-thao'), false)
})

test('cấu hình công khai khóa đúng trần thưởng đã duyệt', () => {
  const config = wordChain.publicConfig()
  assert.equal(config.answerCost, 1)
  assert.equal(config.turnMs, 8000)
  assert.equal(config.roundPayoutCap, 60)
  assert.equal(config.dailyPayoutCap, 250)
})

test('serialize không lộ username ra UI', () => {
  const payload = wordChain.serializeRound({
    _id: 'round-1',
    roundNumber: 1,
    status: 'playing',
    seedPhrase: 'thể thao',
    currentPhrase: 'thao tác',
    requiredSyllable: 'tác',
    participantIds: ['user-1'],
    moves: [{ userId: 'user-1', username: 'alice', displayName: 'Alice Nguyễn', phrase: 'thao tác' }],
    lastPlayer: { userId: 'user-1', username: 'alice', displayName: 'Alice Nguyễn' },
  })
  assert.equal(payload.moves[0].displayName, 'Alice Nguyễn')
  assert.equal(Object.hasOwn(payload.moves[0], 'username'), false)
})

test('catalog Kaikki chứa cụm có nghĩa và loại ví dụ bịa', () => {
  const phrases = new Set(catalog.map((entry) => entry.normalizedPhrase))
  assert.ok(catalog.length > 10000)
  assert.equal(phrases.has('thao tác'), true)
  assert.equal(phrases.has('thao mao'), false)
  assert.ok(catalog.every((entry) => splitPhrase(entry.normalizedPhrase).length === 2))
  assert.ok(catalog.every((entry) => entry.definition))
})
