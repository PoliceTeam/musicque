const { cardValue, sortHand } = require('./cards')
const classify = (cards) => {
  if (!Array.isArray(cards) || !cards.length || cards.length > 13 || new Set(cards).size !== cards.length || cards.some((card) => cardValue(card) < 0)) return null
  const sorted = sortHand(cards)
  const ranks = sorted.map((card) => Math.floor(cardValue(card) / 4))
  const unique = [...new Set(ranks)]
  const length = cards.length
  const top = cardValue(sorted[length - 1])
  let type = null
  if (unique.length === 1 && length <= 4) type = ['single', 'pair', 'triple', 'quad'][length - 1]
  const consecutive = unique.every((rank, i) => !i || rank === unique[i - 1] + 1) && !unique.includes(12)
  if (length >= 3 && unique.length === length && consecutive) type = 'straight'
  if (length >= 6 && unique.length * 2 === length && unique.every((rank) => ranks.filter((r) => r === rank).length === 2) && consecutive) type = 'pairSequence'
  return type ? { type, length, top } : null
}
const canBeat = (play, current) => {
  if (!play) return false
  if (!current) return true
  if (play.type === current.type && play.length === current.length) return play.top > current.top
  const singleTwo = current.type === 'single' && current.top >= 48
  const pairTwo = current.type === 'pair' && current.top >= 48
  const threePairs = current.type === 'pairSequence' && current.length === 6
  if (play.type === 'pairSequence' && play.length === 6) return singleTwo
  if (play.type === 'quad') return singleTwo || pairTwo || threePairs
  if (play.type === 'pairSequence' && play.length === 8) return singleTwo || pairTwo || threePairs || current.type === 'quad'
  return false
}
const isValidLead = (cards, { mustInclude } = {}) => Boolean(classify(cards) && (!mustInclude || cards.includes(mustInclude)))
module.exports = { classify, canBeat, isValidLead }
