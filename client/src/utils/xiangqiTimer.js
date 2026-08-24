export const syncXiangqiTimer = (game, monotonicNow = 0) => ({
  remainingMs: Math.max(0, Number(game?.rewardTimeRemainingMs) || 0),
  syncedAt: monotonicNow,
  running: Boolean(game?.rewardEligible && game?.rewardDeadlineAt),
})

export const getXiangqiRemainingMs = (timer, monotonicNow = 0) => {
  if (!timer) return 0
  const elapsed = timer.running ? Math.max(0, monotonicNow - timer.syncedAt) : 0
  return Math.max(0, timer.remainingMs - elapsed)
}

export const formatXiangqiTime = (remainingMs) => {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
