const axios = require("axios");

const BASE_URL = process.env.WC2026_API_URL || "https://api.wc2026api.com";
const API_KEY = process.env.WC2026_API_KEY;

const TTL_MINUTES = 10;
const TTL_MS = TTL_MINUTES * 60 * 1000;
const cache = new Map();

function getCached(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.data;
  }

  return null;
}

function normalizeTeam(team, fallback) {
  if (!team) return fallback;
  if (typeof team === "string") return team;

  return (
    team.name ||
    team.country ||
    team.display_name ||
    team.short_name ||
    team.code ||
    fallback
  );
}

function normalizeMatch(match) {
  const homeTeam = normalizeTeam(
    match.home_team || match.homeTeam || match.home,
    match.home_team_name || match.homeTeamName || "TBD"
  );
  const awayTeam = normalizeTeam(
    match.away_team || match.awayTeam || match.away,
    match.away_team_name || match.awayTeamName || "TBD"
  );
  const kickoffUtc =
    match.kickoff_utc ||
    match.kickoffUtc ||
    match.kickoff ||
    match.start_time ||
    match.startTime ||
    match.datetime ||
    match.date;

  return {
    id: match.id || match.match_id || match.matchNumber || match.match_number,
    matchNumber: match.match_number || match.matchNumber || match.number,
    round: match.round || match.stage || match.phase,
    groupName: match.group_name || match.groupName || match.group,
    homeTeam,
    awayTeam,
    stadium:
      match.stadium?.name || match.stadium || match.venue?.name || match.venue,
    city: match.city || match.stadium?.city || match.venue?.city,
    country: match.country || match.stadium?.country || match.venue?.country,
    kickoffUtc,
    status: match.status || "scheduled",
    homeScore: match.home_score ?? match.homeScore ?? match.score?.home ?? null,
    awayScore: match.away_score ?? match.awayScore ?? match.score?.away ?? null,
  };
}

function getMatchesArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.matches)) return payload.matches;
  if (Array.isArray(payload?.results)) return payload.results;

  return [];
}

async function fetchWorldCupMatches() {
  if (!API_KEY) {
    throw new Error("Thiếu WC2026_API_KEY trong cấu hình backend");
  }

  const { data } = await axios.get(`${BASE_URL}/matches`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: "application/json",
    },
    timeout: 15000,
  });

  return getMatchesArray(data)
    .map(normalizeMatch)
    .filter((match) => match.kickoffUtc)
    .sort((a, b) => new Date(a.kickoffUtc) - new Date(b.kickoffUtc));
}

async function getWorldCupMatches({ limit = 8 } = {}) {
  const cacheKey = "world-cup-matches";
  const cached = getCached(cacheKey);
  const matches = cached || (await fetchWorldCupMatches());

  if (!cached) {
    cache.set(cacheKey, { at: Date.now(), data: matches });
  }

  const now = Date.now();
  const visibleMatches = matches.filter((match) => {
    const kickoff = new Date(match.kickoffUtc).getTime();
    return kickoff >= now - 3 * 60 * 60 * 1000;
  });

  return {
    matches: (visibleMatches.length ? visibleMatches : matches).slice(0, limit),
    source: "WC2026 API",
    updatedAt: new Date().toISOString(),
    cacheTtlMinutes: TTL_MINUTES,
  };
}

module.exports = {
  getWorldCupMatches,
  fetchWorldCupMatches,
};
