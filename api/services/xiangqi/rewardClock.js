const toMillis = (value) => {
  if (!value) return null
  const millis = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(millis) ? millis : null
}

const getRewardClockState = (game, now = Date.now()) => {
  const rawRemaining = Number(game.rewardTimeRemainingMs)
  if (!Number.isFinite(rawRemaining)) {
    return {
      remainingMs: null,
      rewardEligible: Boolean(game.rewardEligible),
      ineligibleReason: game.rewardIneligibleReason,
      deadlineAt: null,
      timedOut: false,
    }
  }
  const configured = Math.max(0, rawRemaining)
  const startedAt = toMillis(game.rewardClockStartedAt)
  const running = game.status === 'user_turn' && startedAt !== null
  const elapsed = running ? Math.max(0, now - startedAt) : 0
  const remainingMs = Math.max(0, configured - elapsed)
  const timedOut = Boolean(game.rewardEligible) && remainingMs <= 0
  const rewardEligible = Boolean(game.rewardEligible) && !timedOut

  return {
    remainingMs,
    rewardEligible,
    ineligibleReason: timedOut ? 'timeout' : game.rewardIneligibleReason,
    deadlineAt: running && rewardEligible ? new Date(now + remainingMs) : null,
    timedOut,
  }
}

const pauseRewardClock = (game, now = Date.now()) => {
  const state = getRewardClockState(game, now)
  return {
    rewardTimeRemainingMs: state.remainingMs,
    rewardClockStartedAt: null,
    rewardEligible: state.rewardEligible,
    rewardIneligibleReason: state.ineligibleReason,
    ...(state.timedOut && !game.rewardExpiredAt ? { rewardExpiredAt: new Date(now) } : {}),
  }
}

const resumeRewardClock = (game, now = Date.now()) => {
  const state = getRewardClockState(game, now)
  return {
    rewardTimeRemainingMs: state.remainingMs,
    rewardClockStartedAt: state.rewardEligible ? new Date(now) : null,
    rewardEligible: state.rewardEligible,
    rewardIneligibleReason: state.ineligibleReason,
    ...(state.timedOut && !game.rewardExpiredAt ? { rewardExpiredAt: new Date(now) } : {}),
  }
}

module.exports = { getRewardClockState, pauseRewardClock, resumeRewardClock }
