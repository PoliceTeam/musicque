const { randomInt } = require('node:crypto')
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']
const SUITS = ['S', 'C', 'D', 'H']
const cardValue = (card) => {
  if (typeof card !== 'string') return -1
  const rank = RANKS.indexOf(card.slice(0, -1))
  const suit = SUITS.indexOf(card.slice(-1))
  return rank < 0 || suit < 0 ? -1 : rank * 4 + suit
}
const createDeck = () => RANKS.flatMap((rank) => SUITS.map((suit) => rank + suit))
const sortHand = (hand) => [...hand].sort((a, b) => cardValue(a) - cardValue(b))
const shuffle = (deck, rng = () => randomInt(0x100000000) / 0x100000000) => {
  const result = [...deck]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
const deal = (rng) => {
  const deck = shuffle(createDeck(), rng)
  return Array.from({ length: 4 }, (_, i) => sortHand(deck.slice(i * 13, i * 13 + 13)))
}
module.exports = { RANKS, SUITS, cardValue, createDeck, sortHand, shuffle, deal }
