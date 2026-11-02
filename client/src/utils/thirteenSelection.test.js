import { expect, it } from 'vitest'
import { legalPlays, selectionFeedback, smartTap } from './thirteenSelection'
import { classify, canBeat } from './thirteen'
it('names every combo and gives a visible legal-play reason', () => {
  for (const [cards, name] of [['7S 7H', 'Đôi 7'], ['5S 6H 7S 8C 9D', 'Sảnh 5→9'], ['8S 8C 8D 8H', 'Tứ quý 8'], ['3S 3H 4S 4H 5S 5H', '3 đôi thông'], ['AS', 'Lẻ A'], ['2S 2C 2H', 'Bộ ba 2']]) expect(selectionFeedback(cards.split(' ')).name).toBe(name)
  expect(selectionFeedback(['3S', '5S']).reason).toBe('Không hợp lệ')
  expect(selectionFeedback(['4S'], { mustInclude: '3S' }).reason).toBe('Phải có 3♠')
  expect(selectionFeedback(['7S', '7H'], { trick: { cards: ['8S', '8H'] } }).reason).toBe('Nhỏ hơn bài trên bàn')
  expect(selectionFeedback(['9S'], { trick: { cards: ['8S', '8H'] } }).reason).toBe('Khác loại')
  expect(selectionFeedback(['9S', '9H'], { trick: { cards: ['8S', '8H'] } })).toMatchObject({ valid: true, reason: 'Chặt được' })
  expect(selectionFeedback(['2S'], {}, ['3S']).valid).toBe(false)
})
it('orders responses by strength, retains suit variants, and restricts initial leads', () => {
  const hand = ['3S', '7S', '7C', '7H', '9S', '9H', '2S']
  expect(legalPlays(hand, { trick: { cards: ['6S', '6H'] } })).toEqual([['7S', '7C'], ['7S', '7H'], ['7C', '7H'], ['9S', '9H']])
  const leads = legalPlays(hand, { mustInclude: '3S' })
  expect(leads).toEqual([['3S']])
  expect(legalPlays(['3S', '3H', '4S', '4H', '5S', '5H', '8S', '8C', '8D', '8H'], { trick: { cards: ['2H'] } }).map(cards => classify(cards).type)).toEqual(['pairSequence', 'quad'])
})
it('includes every bomb tier and never suggests an illegal response or two in a straight', () => {
  const hand = ['3S', '3H', '4S', '4H', '5S', '5H', '6S', '6H', '8S', '8C', '8D', '8H', '2S']
  for (const cards of [['2S'], ['2S', '2H'], ['7S', '7C', '7D', '7H']]) {
    const plays = legalPlays(hand, { trick: { cards } })
    expect(plays.length).toBeGreaterThan(0)
    expect(plays.every(play => canBeat(classify(play), classify(cards)))).toBe(true)
  }
  expect(legalPlays(['KS', 'AS', '2S']).some(cards => cards.length === 3)).toBe(false)
})
it('smart taps choose the smallest legal combo containing the tapped card only on an empty response selection', () => {
  const plays = legalPlays(['3S', '9S', '9C', '9H'], { trick: { cards: ['8S', '8H'] } })
  expect(smartTap('9S', [], plays, true)).toEqual(['9S', '9C'])
  expect(smartTap('3S', [], plays, true)).toEqual(['3S'])
  expect(smartTap('9S', [], plays, false)).toEqual(['9S'])
  expect(smartTap('9H', ['9S'], plays, true)).toEqual(['9S', '9H'])
  expect(smartTap('9S', ['9S', '9H'], plays, true)).toEqual(['9H'])
})
