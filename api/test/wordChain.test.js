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
  assert.equal(config.botEnabled, true)
  assert.equal(config.botTriggerMs, 1000)
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

test('serialize tính bot là một người chơi nhưng không lộ username bot', () => {
  const payload = wordChain.serializeRound({
    _id: 'round-bot',
    roundNumber: 2,
    status: 'playing',
    seedPhrase: 'thể thao',
    currentPhrase: 'thao tác',
    requiredSyllable: 'tác',
    participantIds: ['user-1'],
    botJoined: true,
    moves: [{ username: 'wordchain_bot', displayName: 'Bot Nối Từ', isBot: true, phrase: 'thao tác', stake: 0 }],
    lastPlayer: { username: 'wordchain_bot', displayName: 'Bot Nối Từ', isBot: true },
  })
  assert.equal(payload.participantCount, 2)
  assert.equal(payload.botJoined, true)
  assert.equal(payload.moves[0].isBot, true)
  assert.equal(payload.lastPlayer.isBot, true)
  assert.equal(Object.hasOwn(payload.lastPlayer, 'username'), false)
})

test('bot chỉ đáp khi còn một người thật hoặc đã tham gia ván', () => {
  assert.equal(wordChain.shouldBotReply({
    status: 'playing', participantIds: ['user-1'], botJoined: false, lastPlayer: { userId: 'user-1' },
  }), true)
  assert.equal(wordChain.shouldBotReply({
    status: 'playing', participantIds: ['user-1', 'user-2'], botJoined: false, lastPlayer: { userId: 'user-2' },
  }), false)
  assert.equal(wordChain.shouldBotReply({
    status: 'playing', participantIds: ['user-1', 'user-2'], botJoined: true, lastPlayer: { userId: 'user-1' },
  }), true)
  assert.equal(wordChain.shouldBotReply({
    status: 'playing', participantIds: ['user-1'], botJoined: true, lastPlayer: { isBot: true },
  }), false)
})

test('catalog Kaikki chứa cụm có nghĩa và loại ví dụ bịa', () => {
  const phrases = new Set(catalog.map((entry) => entry.normalizedPhrase))
  assert.ok(catalog.length > 10000)
  assert.equal(phrases.has('thao tác'), true)
  assert.equal(phrases.has('thao mao'), false)
  assert.ok(catalog.every((entry) => splitPhrase(entry.normalizedPhrase).length === 2))
  assert.ok(catalog.every((entry) => entry.definition))
})
