export const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']
export const SUITS = ['S', 'C', 'D', 'H']
export const cardValue = (card) => {
  if (typeof card !== 'string') return -1
  const rank = RANKS.indexOf(card.slice(0, -1))
  const suit = SUITS.indexOf(card.slice(-1))
  return rank < 0 || suit < 0 ? -1 : rank * 4 + suit
}
export const sortHand = (hand) => [...hand].sort((a, b) => cardValue(a) - cardValue(b))
export const cardNodeName = (cardId) => {
  if (cardValue(cardId) < 0) return null
  const suit = { S: 'Spade', C: 'Club', D: 'Diamond', H: 'Heart' }[cardId.slice(-1)]
  const rank = cardId.slice(0, -1)
  return `${suit}_${{ A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' }[rank] || rank}`
}
