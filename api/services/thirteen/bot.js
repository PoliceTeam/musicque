const { sortHand } = require('./cards')
const { classify, canBeat } = require('./rules')
const findCombos = (hand) => {
  const cards = sortHand(hand)
  const combos = []
  // At most 13 cards: exhaustive subsets keep every suit variant legal and deterministic.
  for (let mask = 1; mask < 2 ** cards.length; mask++) {
    const subset = cards.filter((_, i) => mask & (1 << i))
    const combo = classify(subset)
    if (combo) combos.push({ cards: subset, ...combo })
  }
  return combos.sort((a, b) => a.top - b.top || a.length - b.length || a.cards.join().localeCompare(b.cards.join()))
}
const chooseMove = (hand, current, { mustInclude } = {}) => {
  const sorted = sortHand(hand)
  if (!sorted.length) return null
  const combos = findCombos(sorted)
  if (!current) {
    const lowest = mustInclude || sorted[0]
    return combos.find((combo) => combo.type === 'pair' && combo.cards.includes(lowest))?.cards || [lowest]
  }
  const ordinary = combos.find((combo) => combo.type === current.type && combo.length === current.length && canBeat(combo, current))
  if (ordinary) return ordinary.cards
  if (current.top >= 48) return combos.find((combo) => canBeat(combo, current))?.cards || null
  return null
}
module.exports = { chooseMove, findCombos }
