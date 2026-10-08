import { RANKS, cardValue, sortHand } from './cards'
import { classify, canBeat, isValidLead } from './thirteen'

export function selectionFeedback(cards, table = {}, hand = cards) {
  if (!cards.length) return { name: '', reason: 'Chọn bài rồi đánh', valid: false }
  const combo = classify(cards)
  if (!combo || cards.some(card => !hand.includes(card))) return { name: '', reason: 'Không hợp lệ', valid: false }
  const sorted = sortHand(cards)
  const rank = RANKS[Math.floor(combo.top / 4)]
  const name = { single: `Lẻ ${rank}`, pair: `Đôi ${rank}`, triple: `Bộ ba ${rank}`, quad: `Tứ quý ${rank}`, straight: `Sảnh ${sorted[0].slice(0, -1)}→${rank}`, pairSequence: `${cards.length / 2} đôi thông` }[combo.type]
  const current = classify(table.trick?.cards)
  let reason = ''
  if (!current && table.mustInclude && !cards.includes(table.mustInclude)) reason = 'Phải có 3♠'
  else if (current && !canBeat(combo, current)) reason = combo.type === current.type && combo.length === current.length ? 'Nhỏ hơn bài trên bàn' : 'Khác loại'
  return { name, reason: reason || (current ? 'Chặt được' : 'Đánh được'), valid: !reason }
}

export function legalPlays(hand, table = {}) {
  const cards = sortHand(hand)
  const current = classify(table.trick?.cards)
  const combos = []
  // Tối đa 13 lá: duyệt mọi tập con để giữ đủ biến thể chất.
  for (let mask = 1; mask < 2 ** cards.length; mask++) {
    const subset = cards.filter((_, i) => mask & (1 << i))
    const combo = classify(subset)
    if (combo && (current ? canBeat(combo, current) : isValidLead(subset, table))) combos.push({ cards: subset, ...combo })
  }
  const strength = combo => !current || combo.type === current.type && combo.length === current.length ? 0 : combo.type === 'quad' ? 2 : combo.length === 6 ? 1 : 3
  return combos.sort((a, b) => strength(a) - strength(b) || a.top - b.top || a.length - b.length || a.cards.reduce((mask, card) => mask + 2 ** cardValue(card), 0) - b.cards.reduce((mask, card) => mask + 2 ** cardValue(card), 0)).map(combo => combo.cards)
}

export function smartTap(card, selected, plays, responseTurn) {
  if (!selected.length && responseTurn) {
    const combo = plays.find(cards => cards.includes(card))
    if (combo) return combo
  }
  return selected.includes(card) ? selected.filter(value => value !== card) : [...selected, card]
}
