const { deal } = require('./cards')
const { classify, canBeat } = require('./rules')
const { applyMove, mustIncludeFor } = require('./engine')
const { chooseMove } = require('./bot')
const { splitPot } = require('./payout')
const { GameRuleError } = require('../tableGame/definition')
const stake = Number(process.env.THIRTEEN_STAKE_PC || 10)
module.exports = {
  name: 'thirteen',
  seats: { min: 2, max: 4 },
  config: {
    maxTables: Number(process.env.THIRTEEN_MAX_TABLES || 20),
    stake,
    stakeOptions: [...new Set([...(process.env.THIRTEEN_STAKE_OPTIONS || '0,10,20,50,100').split(',').map(Number), stake])].sort((a, b) => a - b),
    turnMs: Number(process.env.THIRTEEN_TURN_MS || 20000),
    readyCountdownMs: Number(process.env.THIRTEEN_READY_COUNTDOWN_MS || 3000),
    readyTimeoutMs: Number(process.env.THIRTEEN_READY_TIMEOUT_MS || 30000),
    idleSeatMs: Number(process.env.THIRTEEN_IDLE_SEAT_MS || 300000),
    botDelayMs: Number(process.env.THIRTEEN_BOT_DELAY_MS || 1200),
  },
  ledger: { stake: 'thirteen_stake', payout: 'thirteen_payout', refund: 'thirteen_refund' },
  setup: ({ rng, previous }) => {
    const hands = deal(rng)
    const currentSeat = previous ? previous.winnerSeat : hands.findIndex((hand) => hand.includes('3S'))
    return { status: 'playing', seats: hands.map((hand) => ({ hand, finishedPlace: null, passed: false })), currentSeat, leaderSeat: currentSeat, trick: null, isFirstGame: !previous, moves: [], finishOrder: [] }
  },
  currentSeat: (state) => state.status === 'playing' ? state.currentSeat : null,
  applyMove: (state, seat, move) => {
    if (!move || !['play', 'pass'].includes(move.type) || (move.type === 'play' && !Array.isArray(move.cards))) throw new GameRuleError('Invalid move format')
    const cards = move.type === 'play' ? move.cards : null
    try {
      const next = applyMove(state, seat, cards)
      const combo = classify(cards), previousCombo = classify(state.trick?.cards || [])
      const isBomb = Boolean(previousCombo && combo && ['quad', 'pairSequence'].includes(combo.type) && canBeat(combo, previousCombo))
      return { ...next, moves: [...state.moves, { seat, cards: cards || [], isBomb }] }
    } catch (error) { throw new GameRuleError(error.message) }
  },
  timeoutMove: (state, seat) => state.trick ? { type: 'pass' } : { type: 'play', cards: [state.seats[seat].hand[0]] },
  botMove: (state, seat) => {
    const cards = chooseMove(state.seats[seat].hand, state.trick ? classify(state.trick.cards) : null, { mustInclude: mustIncludeFor(state) })
    return cards ? { type: 'play', cards } : { type: 'pass' }
  },
  playerView: (state, seat) => ({ hand: [...state.seats[seat].hand] }),
  publicView: (state) => ({
    seats: state.seats.map((seat) => ({ handCount: seat.hand.length, ...(seat.finishedPlace ? { finishedPlace: seat.finishedPlace } : {}), ...(seat.passed ? { passed: true } : {}) })),
    trick: state.trick ? { cards: [...state.trick.cards], bySeat: state.trick.bySeat, isBomb: Boolean(state.moves.findLast(move => move.cards.length)?.isBomb) } : null,
    lastMove: state.moves.length ? { ...state.moves.at(-1), sequence: state.moves.length } : null,
    mustInclude: mustIncludeFor(state) || null,
    ...(state.finishOrder.length === 4 ? { remainingHands: state.seats.map((seat) => [...seat.hand]) } : {}),
  }),
  result: (state) => state.finishOrder.length === 4 ? { ranking: [...state.finishOrder] } : null,
  payout: splitPot,
}
