const splitPot = (stake, humanIdsInRankOrder) => {
  const shares = { 2: [100, 0], 3: [70, 30, 0], 4: [60, 30, 10, 0] }[humanIdsInRankOrder.length]
  const pot = shares ? stake * humanIdsInRankOrder.length : 0
  const payouts = humanIdsInRankOrder.map((userId, i) => ({ userId, amount: shares ? Math.floor(pot * shares[i] / 100) : 0 }))
  if (payouts.length) payouts[0].amount += pot - payouts.reduce((sum, payout) => sum + payout.amount, 0)
  return payouts
}
module.exports = { splitPot }
