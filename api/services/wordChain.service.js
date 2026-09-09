const WordEntry = require('../models/wordEntry.model')
const WordChainRound = require('../models/wordChainRound.model')
const Session = require('../models/session.model')
const User = require('../models/user.model')
const coins = require('./coins.service')
const starterWords = require('../data/wordchain/starter-words.json')
const dictionaryCatalog = require('../data/wordchain/catalog.json')
const { normalizePhrase, splitPhrase, isValidTwoSyllablePhrase } = require('./wordChain/normalization')

const TURN_MS = Number(process.env.WORDCHAIN_TURN_MS || 8000)
const IDLE_MS = Number(process.env.WORDCHAIN_IDLE_MS || 30000)
const BETWEEN_ROUNDS_MS = Number(process.env.WORDCHAIN_BETWEEN_ROUNDS_MS || 5000)
const BOT_ENABLED = process.env.WORDCHAIN_BOT_ENABLED !== 'false'
const BOT_TRIGGER_MS = Math.min(
  Math.max(0, TURN_MS - 100),
  Math.max(0, Number(process.env.WORDCHAIN_BOT_TRIGGER_MS || 1000)),
)
const ANSWER_COST = 1
const PAYOUT_MULTIPLIER = 3
const ROUND_PAYOUT_CAP = Number(process.env.WORDCHAIN_ROUND_PAYOUT_CAP || 60)
const DAILY_PAYOUT_CAP = Number(process.env.WORDCHAIN_DAILY_PAYOUT_CAP || 250)
const MIN_TURNS_FOR_REWARD = 3
const MIN_PLAYERS_FOR_REWARD = 2
const BOT_PLAYER = Object.freeze({
  username: 'wordchain_bot',
  displayName: 'Bot Nối Từ',
  isBot: true,
})

let ioRef = null
let running = false
let sessionId = null
let currentRoundId = null
let roundCounter = 0
let timer = null
let submissionQueue = Promise.resolve()
let dictionaryReadyPromise = null

class WordChainError extends Error {
  constructor(message, status = 400, code = 'WORDCHAIN_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

const publicConfig = () => ({
  turnMs: TURN_MS,
  idleMs: IDLE_MS,
  botEnabled: BOT_ENABLED,
  botTriggerMs: BOT_TRIGGER_MS,
  botDisplayName: BOT_PLAYER.displayName,
  answerCost: ANSWER_COST,
  payoutMultiplier: PAYOUT_MULTIPLIER,
  roundPayoutCap: ROUND_PAYOUT_CAP,
  dailyPayoutCap: DAILY_PAYOUT_CAP,
  minTurnsForReward: MIN_TURNS_FOR_REWARD,
  minPlayersForReward: MIN_PLAYERS_FOR_REWARD,
})

const dateKeyNow = () => {
  const now = new Date()
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
}

const serializeRound = (round) => {
  if (!round) return null
  const participantCount = (round.participantIds?.length || 0) + (round.botJoined ? 1 : 0)
  const moves = (round.moves || []).slice(-30).map((move) => ({
    userId: move.userId,
    displayName: move.displayName || move.username,
    isBot: Boolean(move.isBot),
    phrase: move.phrase,
    submittedAt: move.submittedAt,
  }))
  return {
    _id: round._id,
    roundNumber: round.roundNumber,
    status: round.status,
    seedPhrase: round.seedPhrase,
    currentPhrase: round.currentPhrase,
    requiredSyllable: round.requiredSyllable,
    moves,
    turnCount: round.moves?.length || 0,
    participantCount,
    botJoined: Boolean(round.botJoined),
    lastPlayer: round.lastPlayer
      ? {
          userId: round.lastPlayer.userId,
          displayName: round.lastPlayer.displayName || round.lastPlayer.username,
          isBot: Boolean(round.lastPlayer.isBot),
        }
      : null,
    idleEndsAt: round.idleEndsAt,
    deadlineAt: round.deadlineAt,
    winner: round.winner
      ? {
          userId: round.winner.userId,
          displayName: round.winner.displayName || round.winner.username,
          isBot: Boolean(round.winner.isBot),
        }
      : null,
    requestedPayout: round.requestedPayout || 0,
    payout: round.payout || 0,
    rewardEligible: Boolean(round.rewardEligible),
    rewardReason: round.rewardReason || null,
    finishReason: round.finishReason || null,
    serverNow: Date.now(),
  }
}

const broadcast = (event, payload) => {
  if (ioRef) ioRef.emit(event, payload)
}

const clearGameTimer = () => {
  if (timer) clearTimeout(timer)
  timer = null
}

const shouldBotReply = (round) => {
  if (!BOT_ENABLED || round?.status !== 'playing' || round.lastPlayer?.isBot) return false
  const humanCount = round.participantIds?.length || 0
  return Boolean(round.botJoined) || humanCount === 1
}

const seedDictionary = async () => {
  await WordEntry.init()
  const importedCount = await WordEntry.countDocuments({ source: 'kaikki-wiktionary' })
  if (importedCount > 0) return importedCount

  if (dictionaryCatalog.length > 0) {
    for (let index = 0; index < dictionaryCatalog.length; index += 1000) {
      const batch = dictionaryCatalog.slice(index, index + 1000).map((entry) => ({
        updateOne: {
          filter: { normalizedPhrase: entry.normalizedPhrase },
          update: {
            $set: {
              ...entry,
              source: 'kaikki-wiktionary',
              status: 'approved',
            },
          },
          upsert: true,
        },
      }))
      await WordEntry.bulkWrite(batch, { ordered: false })
    }
    console.log(`[Nối từ] Đã seed ${dictionaryCatalog.length} mục từ Kaikki/Wiktionary`)
    return dictionaryCatalog.length
  }

  const operations = starterWords.map((phrase) => {
    const normalizedPhrase = normalizePhrase(phrase)
    const [firstSyllable, lastSyllable] = splitPhrase(normalizedPhrase)
    return {
      updateOne: {
        filter: { normalizedPhrase },
        update: {
          $setOnInsert: {
            phrase,
            normalizedPhrase,
            firstSyllable,
            lastSyllable,
            partOfSpeech: 'unknown',
            definition: 'Mục từ bootstrap đã được biên tập cho game nối từ MusicQue.',
            source: 'musicque-starter',
            status: 'approved',
          },
        },
        upsert: true,
      },
    }
  })
  await WordEntry.bulkWrite(operations, { ordered: false })

  const outgoing = await WordEntry.aggregate([
    { $match: { status: 'approved' } },
    { $group: { _id: '$firstSyllable', count: { $sum: 1 } } },
  ])
  const counts = new Map(outgoing.map((item) => [item._id, item.count]))
  const updates = starterWords.map((phrase) => {
    const normalizedPhrase = normalizePhrase(phrase)
    const lastSyllable = splitPhrase(normalizedPhrase)[1]
    const nextWordCount = counts.get(lastSyllable) || 0
    return {
      updateOne: {
        filter: { normalizedPhrase },
        update: { $set: { nextWordCount, starterEligible: nextWordCount >= 2 } },
      },
    }
  })
  await WordEntry.bulkWrite(updates, { ordered: false })
  console.log(`[Nối từ] Đã seed ${starterWords.length} mục từ bootstrap`)
  return starterWords.length
}

const ensureDictionary = () => {
  if (!dictionaryReadyPromise) {
    dictionaryReadyPromise = seedDictionary().catch((error) => {
      dictionaryReadyPromise = null
      throw error
    })
  }
  return dictionaryReadyPromise
}

const chooseSeed = async () => {
  let [seed] = await WordEntry.aggregate([
    { $match: { status: 'approved', starterEligible: true } },
    { $sample: { size: 1 } },
  ])
  if (!seed) {
    ;[seed] = await WordEntry.aggregate([
      { $match: { status: 'approved', nextWordCount: { $gt: 0 } } },
      { $sample: { size: 1 } },
    ])
  }
  if (!seed) throw new WordChainError('Từ điển nối từ chưa có dữ liệu phù hợp', 503, 'DICTIONARY_EMPTY')
  return seed
}

const scheduleCurrentRound = (round) => {
  clearGameTimer()
  if (!running || !round) return
  const endsAt = round.status === 'waiting' ? round.idleEndsAt : round.deadlineAt
  if (!endsAt) return
  const endMs = new Date(endsAt).getTime()
  const botReplyAt = shouldBotReply(round) ? endMs - BOT_TRIGGER_MS : null
  const targetMs = botReplyAt === null ? endMs : Math.max(Date.now(), botReplyAt)
  const waitMs = Math.max(0, targetMs - Date.now())
  timer = setTimeout(() => {
    if (round.status === 'waiting') expireIdleRound(round._id).catch(logLoopError)
    else if (botReplyAt !== null) playBotTurn(round._id).catch(logLoopError)
    else settleRound(round._id, { reason: 'timeout' }).catch(logLoopError)
  }, waitMs)
}

const scheduleNextRound = () => {
  clearGameTimer()
  if (!running) return
  timer = setTimeout(() => beginRound().catch(logLoopError), BETWEEN_ROUNDS_MS)
}

const logLoopError = (error) => console.error('[Nối từ] Game loop lỗi:', error.message)

const chooseBotAnswer = async (round) => {
  const match = {
    status: 'approved',
    firstSyllable: round.requiredSyllable,
    normalizedPhrase: { $nin: round.usedWords || [] },
  }
  let [answer] = await WordEntry.aggregate([
    { $match: { ...match, nextWordCount: { $gt: 0 } } },
    { $sample: { size: 1 } },
  ])
  if (!answer) {
    ;[answer] = await WordEntry.aggregate([{ $match: match }, { $sample: { size: 1 } }])
  }
  return answer || null
}

const playBotTurn = async (roundId) => {
  clearGameTimer()
  if (!running || currentRoundId?.toString() !== roundId.toString()) return null

  const round = await WordChainRound.findById(roundId)
  if (!round || !shouldBotReply(round)) {
    if (round && ['waiting', 'playing'].includes(round.status)) scheduleCurrentRound(round)
    return null
  }
  if (!round.deadlineAt || Date.now() >= new Date(round.deadlineAt).getTime()) {
    return settleRound(roundId, { reason: 'timeout' })
  }

  const answer = await chooseBotAnswer(round)
  if (!answer) {
    const now = new Date()
    const botDefeated = await WordChainRound.findOneAndUpdate(
      {
        _id: round._id,
        status: 'playing',
        version: round.version,
        deadlineAt: { $gt: now },
        'lastPlayer.isBot': { $ne: true },
      },
      {
        $set: { botJoined: true, ...(!round.botJoined ? { botJoinedAt: now } : {}) },
        $inc: { version: 1 },
      },
      { new: true },
    )
    if (botDefeated) return settleRound(roundId, { reason: 'bot_no_answer' })

    const latest = await WordChainRound.findById(roundId)
    if (latest && ['waiting', 'playing'].includes(latest.status)) scheduleCurrentRound(latest)
    return latest
  }

  const now = new Date()
  const requestKey = `bot:${round._id}:${round.version}`
  const updated = await WordChainRound.findOneAndUpdate(
    {
      _id: round._id,
      status: 'playing',
      version: round.version,
      deadlineAt: { $gt: now },
      usedWords: { $ne: answer.normalizedPhrase },
      'lastPlayer.isBot': { $ne: true },
    },
    {
      $set: {
        currentPhrase: answer.phrase,
        requiredSyllable: answer.lastSyllable,
        deadlineAt: new Date(now.getTime() + TURN_MS),
        lastPlayer: BOT_PLAYER,
        botJoined: true,
        ...(!round.botJoined ? { botJoinedAt: now } : {}),
      },
      $push: {
        usedWords: answer.normalizedPhrase,
        moves: {
          ...BOT_PLAYER,
          phrase: answer.phrase,
          normalizedPhrase: answer.normalizedPhrase,
          requestKey,
          stake: 0,
          submittedAt: now,
        },
      },
      $inc: { version: 1 },
    },
    { new: true },
  )

  if (!updated) {
    const latest = await WordChainRound.findById(roundId)
    if (latest && ['waiting', 'playing'].includes(latest.status)) scheduleCurrentRound(latest)
    return latest
  }

  broadcast('wordchain_round', serializeRound(updated))
  scheduleCurrentRound(updated)
  return updated
}

const beginRound = async () => {
  if (!running || !sessionId) return null
  const seed = await chooseSeed()
  roundCounter += 1
  const now = Date.now()
  const round = await WordChainRound.create({
    sessionId,
    roundNumber: roundCounter,
    status: 'waiting',
    seedPhrase: seed.phrase,
    currentPhrase: seed.phrase,
    requiredSyllable: seed.lastSyllable,
    usedWords: [seed.normalizedPhrase],
    idleEndsAt: new Date(now + IDLE_MS),
  })
  currentRoundId = round._id
  broadcast('wordchain_round', serializeRound(round))
  scheduleCurrentRound(round)
  return round
}

const refundMoves = async (round, reason) => {
  for (const move of round.moves || []) {
    if (move.isBot || !move.userId || !move.stake) continue
    await coins.creditOnce(move.userId, move.stake, {
      type: 'wordchain_refund',
      operationKey: `wordchain:refund:${round._id}:${move.requestKey}`,
      referenceType: 'WordChainRound',
      referenceId: round._id,
      metadata: { reason, phrase: move.phrase },
    })
  }
}

const finalizeSettlement = async (round, reason) => {
  const turnCount = round.moves?.length || 0
  const participantCount = (round.participantIds?.length || 0) + (round.botJoined ? 1 : 0)
  const hasWinner = Boolean(round.lastPlayer?.userId || round.lastPlayer?.isBot)
  const rewardEligible = turnCount >= MIN_TURNS_FOR_REWARD
    && participantCount >= MIN_PLAYERS_FOR_REWARD
    && round.lastPlayer?.userId

  if (reason !== 'session_ended' && round.lastPlayer?.isBot && hasWinner) {
    return WordChainRound.findByIdAndUpdate(
      round._id,
      {
        $set: {
          status: 'settled',
          winner: round.lastPlayer,
          requestedPayout: 0,
          payout: 0,
          rewardEligible: false,
          rewardReason: 'Bot Nối Từ chiến thắng',
          finishReason: reason,
          settledAt: new Date(),
        },
      },
      { new: true },
    )
  }

  if (!rewardEligible) {
    await refundMoves(round, reason === 'session_ended' ? 'session_ended_before_eligible' : 'round_not_eligible')
    const humanBeatBot = reason === 'bot_no_answer'
      && Boolean(round.botJoined && round.lastPlayer?.userId)
    const finished = await WordChainRound.findByIdAndUpdate(
      round._id,
      {
        $set: {
          status: humanBeatBot ? 'settled' : 'voided',
          ...(humanBeatBot ? { winner: round.lastPlayer } : {}),
          rewardEligible: false,
          rewardReason: humanBeatBot
            ? 'Bạn thắng bot nhưng chưa đủ 3 lượt, phí đã được hoàn'
            : participantCount < MIN_PLAYERS_FOR_REWARD
            ? 'Chưa đủ 2 người chơi, toàn bộ phí đã được hoàn'
            : 'Chưa đủ 3 lượt nối, toàn bộ phí đã được hoàn',
          finishReason: reason,
          settledAt: new Date(),
        },
      },
      { new: true },
    )
    return finished
  }

  const requestedPayout = Math.min(turnCount * PAYOUT_MULTIPLIER, ROUND_PAYOUT_CAP)
  const operationKey = round.settlementOperationKey || `wordchain:payout:${round._id}`
  const reward = await coins.creditWordChainRewardOnce(round.lastPlayer.userId, requestedPayout, {
    type: 'wordchain_payout',
    operationKey,
    referenceType: 'WordChainRound',
    referenceId: round._id,
    dateKey: dateKeyNow(),
    dailyCap: DAILY_PAYOUT_CAP,
    metadata: { turnCount, participantCount, requestedPayout },
  })
  const payout = reward?.credited || 0
  return WordChainRound.findByIdAndUpdate(
    round._id,
    {
      $set: {
        status: 'settled',
        winner: round.lastPlayer,
        requestedPayout,
        payout,
        rewardEligible: true,
        rewardReason: payout < requestedPayout
          ? `Đã áp dụng trần thưởng ${DAILY_PAYOUT_CAP} PC/ngày`
          : null,
        finishReason: reason,
        settlementOperationKey: operationKey,
        settledAt: new Date(),
      },
    },
    { new: true },
  )
}

const settleRound = async (roundId, { reason = 'timeout', startNext = true } = {}) => {
  clearGameTimer()
  let round = await WordChainRound.findOneAndUpdate(
    { _id: roundId, status: { $in: ['waiting', 'playing'] } },
    { $set: { status: 'settling', settlementOperationKey: `wordchain:payout:${roundId}` } },
    { new: true },
  )
  if (!round) round = await WordChainRound.findById(roundId)
  if (!round) return null
  if (round.status === 'settling') round = await finalizeSettlement(round, reason)

  currentRoundId = null
  broadcast('wordchain_result', serializeRound(round))
  if (running && startNext) scheduleNextRound()
  return round
}

const expireIdleRound = async (roundId) => {
  clearGameTimer()
  const round = await WordChainRound.findOneAndUpdate(
    { _id: roundId, status: 'waiting', moves: { $size: 0 } },
    {
      $set: {
        status: 'voided',
        rewardEligible: false,
        rewardReason: 'Không có người tham gia, hệ thống đã đổi từ mở đầu',
        settledAt: new Date(),
      },
    },
    { new: true },
  )
  if (round) broadcast('wordchain_result', serializeRound(round))
  currentRoundId = null
  if (running) scheduleNextRound()
}

const startGame = async (io, session) => {
  if (io) ioRef = io
  if (running) return getState()
  const active = session || (await Session.findOne({ isActive: true }))
  if (!active) return null

  await ensureDictionary()
  running = true
  sessionId = active._id
  roundCounter = await WordChainRound.countDocuments({ sessionId })
  return beginRound()
}

const stopGame = async ({ reason = 'session_ended' } = {}) => {
  running = false
  clearGameTimer()
  let finalRound = null
  if (currentRoundId) {
    finalRound = await settleRound(currentRoundId, { reason, startNext: false })
  }
  currentRoundId = null
  sessionId = null
  broadcast('wordchain_stopped', { reason, round: serializeRound(finalRound) })
  return finalRound
}

const resumeIfActiveSession = async (io) => {
  ioRef = io
  await ensureDictionary()
  const active = await Session.findOne({ isActive: true })
  if (!active) return null

  running = true
  sessionId = active._id
  roundCounter = await WordChainRound.countDocuments({ sessionId })
  const open = await WordChainRound.findOne({
    sessionId,
    status: { $in: ['waiting', 'playing', 'settling'] },
  }).sort({ roundNumber: -1 })

  if (!open) return beginRound()
  currentRoundId = open._id
  if (open.status === 'settling') {
    const settled = await finalizeSettlement(open, 'resume_settlement')
    broadcast('wordchain_result', serializeRound(settled))
    scheduleNextRound()
    return settled
  }

  const endsAt = open.status === 'waiting' ? open.idleEndsAt : open.deadlineAt
  if (!endsAt || new Date(endsAt).getTime() <= Date.now()) {
    if (open.status === 'waiting') return expireIdleRound(open._id)
    return settleRound(open._id, { reason: 'resume_timeout' })
  }
  broadcast('wordchain_round', serializeRound(open))
  scheduleCurrentRound(open)
  return open
}

const submitAnswerInternal = async ({ user, phrase, requestKey }) => {
  if (!running || !currentRoundId) throw new WordChainError('Game nối từ chưa mở', 409, 'GAME_INACTIVE')
  if (!requestKey || typeof requestKey !== 'string' || requestKey.length > 100) {
    throw new WordChainError('Thiếu mã yêu cầu hợp lệ', 400, 'INVALID_REQUEST_KEY')
  }
  if (!isValidTwoSyllablePhrase(phrase)) {
    throw new WordChainError('Hãy nhập một cụm từ tiếng Việt gồm đúng 2 tiếng', 422, 'INVALID_FORMAT')
  }

  const normalizedPhrase = normalizePhrase(phrase)
  let round = await WordChainRound.findById(currentRoundId)
  if (!round || !['waiting', 'playing'].includes(round.status)) {
    throw new WordChainError('Ván hiện tại đã kết thúc', 409, 'ROUND_FINISHED')
  }
  const duplicate = round.moves.find((move) => move.requestKey === requestKey)
  if (duplicate) {
    const currentUser = await User.findById(user._id).select('polites')
    return { round: serializeRound(round), balance: currentUser?.polites ?? 0, duplicate: true }
  }

  const endsAt = round.status === 'waiting' ? round.idleEndsAt : round.deadlineAt
  if (!endsAt || Date.now() >= new Date(endsAt).getTime()) {
    throw new WordChainError('Đã hết thời gian của lượt này', 409, 'ROUND_EXPIRED')
  }
  if (round.lastPlayer?.userId?.toString() === user._id.toString()) {
    throw new WordChainError('Bạn không thể nối hai lượt liên tiếp', 409, 'CONSECUTIVE_TURN')
  }
  if (round.usedWords.includes(normalizedPhrase)) {
    throw new WordChainError('Cụm từ này đã được dùng trong ván', 409, 'WORD_USED')
  }

  const syllables = splitPhrase(normalizedPhrase)
  if (syllables[0] !== round.requiredSyllable) {
    throw new WordChainError(`Từ tiếp theo phải bắt đầu bằng “${round.requiredSyllable}”`, 422, 'WRONG_CHAIN')
  }
  const dictionaryEntry = await WordEntry.findOne({ normalizedPhrase, status: 'approved' }).lean()
  if (!dictionaryEntry) {
    throw new WordChainError('Cụm từ này chưa có trong từ điển được duyệt', 422, 'WORD_NOT_FOUND')
  }

  const debitOperationKey = `wordchain:answer:${round._id}:${requestKey}`
  const debited = await coins.debit(user._id, ANSWER_COST, {
    type: 'wordchain_answer',
    operationKey: debitOperationKey,
    referenceType: 'WordChainRound',
    referenceId: round._id,
    metadata: { phrase: dictionaryEntry.phrase, requestKey },
  })
  if (!debited) throw new WordChainError('Bạn không đủ PC để trả lời', 409, 'INSUFFICIENT_BALANCE')

  const now = new Date()
  const updated = await WordChainRound.findOneAndUpdate(
    {
      _id: round._id,
      status: { $in: ['waiting', 'playing'] },
      version: round.version,
      usedWords: { $ne: normalizedPhrase },
    },
    {
      $set: {
        status: 'playing',
        currentPhrase: dictionaryEntry.phrase,
        requiredSyllable: dictionaryEntry.lastSyllable,
        deadlineAt: new Date(now.getTime() + TURN_MS),
        lastPlayer: {
          userId: user._id,
          username: user.username,
          displayName: user.displayName || user.username,
        },
      },
      $push: {
        usedWords: normalizedPhrase,
        moves: {
          userId: user._id,
          username: user.username,
          displayName: user.displayName || user.username,
          phrase: dictionaryEntry.phrase,
          normalizedPhrase,
          requestKey,
          stake: ANSWER_COST,
          submittedAt: now,
        },
      },
      $addToSet: { participantIds: user._id },
      $inc: { version: 1 },
    },
    { new: true },
  )

  if (!updated) {
    await coins.creditOnce(user._id, ANSWER_COST, {
      type: 'wordchain_refund',
      operationKey: `wordchain:refund:${round._id}:${requestKey}:race`,
      referenceType: 'WordChainRound',
      referenceId: round._id,
      metadata: { reason: 'answer_race', phrase: dictionaryEntry.phrase },
    })
    throw new WordChainError('Đã có người trả lời trước, 1 PC đã được hoàn', 409, 'ANSWER_RACE')
  }

  round = updated
  broadcast('wordchain_round', serializeRound(round))
  scheduleCurrentRound(round)
  return { round: serializeRound(round), balance: debited.polites, duplicate: false }
}

const submitAnswer = (payload) => {
  const job = submissionQueue.then(() => submitAnswerInternal(payload))
  submissionQueue = job.catch(() => {})
  return job
}

const getState = async () => {
  if (!running || !currentRoundId) return { active: false, round: null, config: publicConfig() }
  const round = await WordChainRound.findById(currentRoundId)
  return { active: Boolean(round), round: serializeRound(round), config: publicConfig() }
}

const getHistory = async (limit = 10) => {
  const active = await Session.findOne({ isActive: true })
  const query = active ? { sessionId: active._id, status: { $in: ['settled', 'voided'] } } : { status: { $in: ['settled', 'voided'] } }
  const rounds = await WordChainRound.find(query).sort({ settledAt: -1 }).limit(Math.min(Math.max(Number(limit) || 10, 1), 30))
  return rounds.map(serializeRound)
}

module.exports = {
  WordChainError,
  publicConfig,
  serializeRound,
  shouldBotReply,
  ensureDictionary,
  startGame,
  stopGame,
  resumeIfActiveSession,
  submitAnswer,
  getState,
  getHistory,
}
