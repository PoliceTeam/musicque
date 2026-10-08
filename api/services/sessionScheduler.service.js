const { endActiveSession } = require('./session.service')

const configuredHour = Number(process.env.SESSION_AUTO_END_HOUR || 18)
const AUTO_END_HOUR = Number.isInteger(configuredHour) && configuredHour >= 0 && configuredHour <= 23
  ? configuredHour
  : 18

let timer = null

const cutoffAt = (date, dayOffset = 0) => new Date(
  date.getFullYear(),
  date.getMonth(),
  date.getDate() + dayOffset,
  AUTO_END_HOUR,
  0,
  0,
  0,
)

const latestElapsedCutoff = (now = new Date()) => {
  const today = cutoffAt(now)
  return now >= today ? today : cutoffAt(now, -1)
}

const nextCutoff = (now = new Date()) => {
  const today = cutoffAt(now)
  return now < today ? today : cutoffAt(now, 1)
}

const closeOverdueSession = async (io, now = new Date()) => {
  const cutoff = latestElapsedCutoff(now)
  const session = await endActiveSession({
    io,
    displayName: 'Hệ thống',
    startedBefore: cutoff,
    automatic: true,
  })

  if (session) {
    console.log(`[Scheduler] Đã tự kết thúc phiên ${session._id} quá hạn lúc ${cutoff.toLocaleString()}`)
  }
  return session
}

const scheduleNextRun = (io, now = new Date()) => {
  const cutoff = nextCutoff(now)
  const delay = cutoff.getTime() - now.getTime()

  console.log(`[Scheduler] Phiên nhạc sẽ tự kết thúc lúc ${cutoff.toLocaleString()}`)
  timer = setTimeout(async () => {
    try {
      await closeOverdueSession(io)
    } catch (error) {
      console.error('[Scheduler] Tự kết thúc phiên lỗi:', error)
    } finally {
      scheduleNextRun(io)
    }
  }, delay)
}

const init = async (io) => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  try {
    await closeOverdueSession(io)
  } finally {
    scheduleNextRun(io)
  }
}

module.exports = {
  AUTO_END_HOUR,
  latestElapsedCutoff,
  nextCutoff,
  closeOverdueSession,
  init,
}
