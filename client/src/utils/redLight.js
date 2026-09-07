export const PHASE = {
  GREEN: 'green',
  TURNING_RED: 'turning_red',
  RED: 'red',
  TURNING_GREEN: 'turning_green',
}

export const STATUS = {
  CLOSED: 'closed',
  LOBBY: 'lobby',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  SETTLED: 'settled',
}

export const getSyncedNow = (serverNow, receivedAt = Date.now(), now = Date.now()) => {
  if (!serverNow) return now
  return now + (serverNow - receivedAt)
}

export const getPhaseAt = (schedule, now) => {
  if (!Array.isArray(schedule) || schedule.length === 0) return null
  for (const phase of schedule) {
    if (now >= phase.startAt && now < phase.endAt) return phase
  }
  if (now < schedule[0].startAt) return schedule[0]
  return schedule[schedule.length - 1]
}

export const phaseAllowsRun = (phase) => {
  if (!phase) return false
  return phase.type === PHASE.GREEN
    || phase.type === PHASE.TURNING_RED
    || phase.type === PHASE.TURNING_GREEN
}

export const isRedPhase = (phase) => phase?.type === PHASE.RED

export const getPhaseLabel = (phase, status) => {
  if (status === STATUS.COUNTDOWN) return 'Sắp bắt đầu'
  if (status === STATUS.SETTLED) return 'Kết quả'
  if (status === STATUS.LOBBY) return 'Chờ người chơi'
  if (!phase) return 'Đèn xanh, Đèn đỏ'
  if (phase.type === PHASE.GREEN || phase.type === PHASE.TURNING_GREEN) return 'Đèn xanh'
  if (phase.type === PHASE.TURNING_RED) return 'Đèn sắp đỏ'
  return 'Đèn đỏ'
}

export const getRemainingMs = (targetAt, now) =>
  Math.max(0, Math.ceil(((targetAt || 0) - now) / 1000))

export const findMe = (state, userId) => {
  if (!userId) return null
  const id = String(userId)
  return (state?.round?.players || []).find((player) => String(player.userId) === id)
    || (state?.lobby || []).find((player) => String(player.userId) === id)
    || null
}

export const isInLobby = (state, userId) => {
  if (!userId) return false
  const id = String(userId)
  return (state?.lobby || []).some((player) => String(player.userId) === id)
}

/**
 * Flat screen-space track. No CSS 3D — ground SVG and sprites share this map.
 * Percentages are of `.rl-stage` (the playable field box).
 */
export const TRACK = {
  start: { x: 14, y: 74 },
  end: { x: 84, y: 30 },
  halfWidth: 11,
  finishAt: 0.92,
}

const trackDelta = () => ({
  dx: TRACK.end.x - TRACK.start.x,
  dy: TRACK.end.y - TRACK.start.y,
})

const trackLength = () => {
  const { dx, dy } = trackDelta()
  return Math.hypot(dx, dy) || 1
}

/** Unit along the run direction. */
export const trackForward = () => {
  const { dx, dy } = trackDelta()
  const len = trackLength()
  return { x: dx / len, y: dy / len }
}

/** Unit perpendicular (points toward the "near" / bottom-right side of the track). */
export const trackPerp = () => {
  const f = trackForward()
  return { x: -f.y, y: f.x }
}

export const trackPoint = (t, lateral = 0) => {
  const clamped = Math.max(0, Math.min(1, t))
  const f = trackForward()
  const p = trackPerp()
  return {
    x: TRACK.start.x + f.x * trackLength() * clamped + p.x * lateral,
    y: TRACK.start.y + f.y * trackLength() * clamped + p.y * lateral,
  }
}

export const trackCorners = () => {
  const hw = TRACK.halfWidth
  return {
    startFar: trackPoint(0, -hw),
    startNear: trackPoint(0, hw),
    endFar: trackPoint(1, -hw),
    endNear: trackPoint(1, hw),
  }
}

export const trackPolygonPoints = () => {
  const c = trackCorners()
  return [c.startFar, c.endFar, c.endNear, c.startNear]
    .map((pt) => `${pt.x},${pt.y}`)
    .join(' ')
}

export const finishLinePolygon = () => {
  const t0 = TRACK.finishAt
  const t1 = Math.min(1, t0 + 0.05)
  const hw = TRACK.halfWidth
  const a = trackPoint(t0, -hw)
  const b = trackPoint(t1, -hw)
  const c = trackPoint(t1, hw)
  const d = trackPoint(t0, hw)
  return [a, b, c, d].map((pt) => `${pt.x},${pt.y}`).join(' ')
}

/** Lane lateral offset in track half-width units. */
export const laneLateral = (lane = 0, playerCount = 1) => {
  const count = Math.max(playerCount, 1)
  const mid = (count - 1) / 2
  const step = (TRACK.halfWidth * 1.35) / Math.max(count, 2)
  return (lane - mid) * step
}

export const projectPawn = (progress, lane = 0, playerCount = 1) => {
  const t = Math.max(0, Math.min(100, Number(progress) || 0)) / 100
  return trackPoint(t * TRACK.finishAt, laneLateral(lane, playerCount))
}

export const finishGateLayout = () => {
  const hw = TRACK.halfWidth
  const far = trackPoint(TRACK.finishAt, -hw)
  const near = trackPoint(TRACK.finishAt, hw)
  const mid = trackPoint(TRACK.finishAt, 0)
  const doll = trackPoint(1.06, -hw * 0.15)
  const signal = trackPoint(1.02, hw * 0.85)
  return {
    far,
    near,
    mid,
    doll,
    signal,
    width: Math.hypot(near.x - far.x, near.y - far.y),
    angle: Math.atan2(near.y - far.y, near.x - far.x) * (180 / Math.PI),
  }
}

/** @deprecated use trackPoint — kept for older call sites during migration */
export const projectGroundPoint = (xPct, yPct) => ({ x: xPct, y: yPct })

/** Dev/UI preview only — no API, no auth, no session. */
export const createMockRedLightPreview = ({
  now = Date.now(),
  phaseType = PHASE.GREEN,
} = {}) => {
  const players = [
    {
      userId: 'mock-you',
      displayName: 'Bạn',
      avatarId: 'cat',
      color: '#3498DB',
      progress: 18,
      status: 'alive',
      holding: false,
      lane: 0,
      isBot: false,
    },
    {
      userId: 'mock-bot-1',
      displayName: 'Bot 1',
      avatarId: 'rabbit',
      color: '#E67E22',
      progress: 42,
      status: 'alive',
      holding: true,
      lane: 1,
      isBot: true,
    },
    {
      userId: 'mock-bot-2',
      displayName: 'Bot 2',
      avatarId: 'fox',
      color: '#9B59B6',
      progress: 61,
      status: 'alive',
      holding: false,
      lane: 2,
      isBot: true,
    },
    {
      userId: 'mock-bot-3',
      displayName: 'Bot 3',
      avatarId: 'panda',
      color: '#1ABC9C',
      progress: 88,
      status: 'alive',
      holding: false,
      lane: 3,
      isBot: true,
    },
  ]

  return {
    active: true,
    status: STATUS.PLAYING,
    lobbyCount: players.length,
    lobby: players.map(({ userId, displayName, avatarId, color, isBot }) => ({
      userId,
      displayName,
      avatarId,
      color,
      isBot,
    })),
    round: {
      roundNumber: 0,
      players,
      currentPhase: { type: phaseType, startAt: now - 1000, endAt: now + 30_000 },
      schedule: [{ type: phaseType, startAt: now - 1000, endAt: now + 30_000 }],
      roundEndsAt: now + 60_000,
      winner: null,
      placements: [],
    },
    config: {
      minPlayers: 4,
      maxPlayers: 12,
      payouts: [25, 10, 5],
      dailyPayoutCap: 80,
    },
    serverNow: now,
  }
}

export const getLobbyOccupancy = ({
  lobbyCount = 0,
  minPlayers = 4,
  maxPlayers = 12,
} = {}) => {
  const have = Math.max(0, Number(lobbyCount) || 0)
  const min = Math.max(1, Number(minPlayers) || 4)
  const max = Math.max(min, Number(maxPlayers) || 12)
  const missing = Math.max(0, min - have)
  const countLabel = `${have}/${max}`
  return {
    have,
    min,
    max,
    missing,
    countLabel,
    statusLabel: missing > 0
      ? `Phòng chờ · ${countLabel} · còn thiếu ${missing}`
      : `Phòng chờ · ${countLabel}`,
  }
}
