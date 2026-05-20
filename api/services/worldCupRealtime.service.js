const { getWorldCupMatches } = require("./worldCup.service");

const MIN_POLL_MS = 30 * 1000;
const MAX_POLL_MS = 30 * 60 * 1000;

let timer = null;
let lastSignature = null;
let started = false;

function clampPollInterval(interval) {
  if (!interval) return MAX_POLL_MS;
  return Math.min(Math.max(interval, MIN_POLL_MS), MAX_POLL_MS);
}

function getScheduleSignature(schedule) {
  return JSON.stringify(
    (schedule.matches || []).map((match) => ({
      id: match.id,
      kickoffUtc: match.kickoffUtc,
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      stadium: match.stadium,
    }))
  );
}

function scheduleNextRun(io, delay) {
  timer = setTimeout(() => {
    pollWorldCupSchedule(io);
  }, clampPollInterval(delay));
}

async function pollWorldCupSchedule(io) {
  try {
    const schedule = await getWorldCupMatches({ limit: 104 });
    const signature = getScheduleSignature(schedule);

    if (signature !== lastSignature) {
      lastSignature = signature;
      io.emit("world_cup_schedule_updated", schedule);
      console.log("[WorldCup] Schedule pushed to clients");
    }

    scheduleNextRun(io, schedule.refreshAfterMs);
  } catch (error) {
    console.error("[WorldCup] Realtime polling failed:", error.message);
    scheduleNextRun(io, MAX_POLL_MS);
  }
}

function startWorldCupRealtime(io) {
  if (started) return;

  started = true;
  pollWorldCupSchedule(io);
}

function stopWorldCupRealtime() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  started = false;
}

module.exports = {
  startWorldCupRealtime,
  stopWorldCupRealtime,
};
