const axios = require("axios");

const BASE_URL = process.env.WC2026_API_URL || "https://api.wc2026api.com";
const API_KEY = process.env.WC2026_API_KEY;

const LIVE_TTL_MS = 30 * 1000;
const MATCH_DAY_TTL_MS = 5 * 60 * 1000;
const DEFAULT_TTL_MS = 30 * 60 * 1000;
const NEAR_MATCH_MS = 6 * 60 * 60 * 1000;
const cache = new Map();

function requireApiKey() {
  if (!API_KEY) {
    throw new Error("Thiếu WC2026_API_KEY trong cấu hình backend");
  }
}

async function apiGet(path, params = {}) {
  requireApiKey();

  const { data } = await axios.get(`${BASE_URL}${path}`, {
    params,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: "application/json",
    },
    timeout: 15000,
  });

  return data;
}

function isLiveStatus(status) {
  return ["live", "in_progress", "first_half", "second_half", "halftime"].includes(
    String(status).toLowerCase()
  );
}

function isSameVietnamDate(timestamp, now) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date(timestamp)) === formatter.format(new Date(now));
}

function getCacheTtlMs(matches, now = Date.now()) {
  if (!matches.length) return DEFAULT_TTL_MS;
  if (matches.some((match) => isLiveStatus(match.status))) return LIVE_TTL_MS;

  const hasNearMatch = matches.some((match) => {
    const kickoff = new Date(match.kickoffUtc).getTime();
    return kickoff >= now - 3 * 60 * 60 * 1000 && kickoff <= now + NEAR_MATCH_MS;
  });

  if (hasNearMatch) return 60 * 1000;

  const hasMatchToday = matches.some((match) => {
    const kickoff = new Date(match.kickoffUtc).getTime();
    return isSameVietnamDate(kickoff, now);
  });

  return hasMatchToday ? MATCH_DAY_TTL_MS : DEFAULT_TTL_MS;
}

function getCached(key) {
  const cached = cache.get(key);
  if (!cached) return null;

  const ttlMs = getCacheTtlMs(cached.data);
  if (Date.now() - cached.at < ttlMs) {
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
  const data = await apiGet("/matches");

  return getMatchesArray(data)
    .map(normalizeMatch)
    .filter((match) => match.kickoffUtc)
    .sort((a, b) => new Date(a.kickoffUtc) - new Date(b.kickoffUtc));
}

function getCachedValue(key, ttlMs) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < ttlMs) return cached;
  return null;
}

async function getAllMatches() {
  const cacheKey = "world-cup-matches";
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const matches = await fetchWorldCupMatches();
  cache.set(cacheKey, { at: Date.now(), data: matches });
  return matches;
}

function getStandingsArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.standings)) return payload.standings;
  if (Array.isArray(payload?.groups)) return payload.groups;
  if (Array.isArray(payload?.results)) return payload.results;

  return [];
}

function normalizeStandingTeam(team, fallbackGroup) {
  const rawTeam = team.team || team.country || team.name || team.team_name || {};
  const teamName = normalizeTeam(rawTeam, team.team_name || team.name || "TBD");

  return {
    rank: team.rank || team.position || team.pos || 0,
    team: teamName,
    code: team.code || rawTeam.code,
    played: team.played ?? team.matches_played ?? team.p ?? 0,
    won: team.won ?? team.wins ?? team.w ?? 0,
    drawn: team.drawn ?? team.draws ?? team.d ?? 0,
    lost: team.lost ?? team.losses ?? team.l ?? 0,
    goalsFor: team.goals_for ?? team.gf ?? team.goalsFor ?? 0,
    goalsAgainst: team.goals_against ?? team.ga ?? team.goalsAgainst ?? 0,
    goalDifference:
      team.goal_difference ?? team.gd ?? team.goalDifference ?? 0,
    points: team.points ?? team.pts ?? 0,
    groupName:
      team.group_name || team.groupName || team.group || fallbackGroup || "N/A",
  };
}

function normalizeStandings(payload) {
  const entries = getStandingsArray(payload);
  const grouped = entries
    .map((entry) => {
      const groupName = entry.group_name || entry.groupName || entry.group || entry.name;
      const teams = entry.teams || entry.table || entry.standings || entry.rows;

      if (Array.isArray(teams)) {
        return {
          groupName,
          teams: teams
            .map((team) => normalizeStandingTeam(team, groupName))
            .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference),
        };
      }

      return null;
    })
    .filter(Boolean);

  if (grouped.length) return grouped;

  const flatGroups = entries.reduce((acc, entry) => {
    const team = normalizeStandingTeam(entry);
    const groupName = team.groupName || "N/A";
    acc[groupName] = acc[groupName] || [];
    acc[groupName].push(team);
    return acc;
  }, {});

  return Object.entries(flatGroups).map(([groupName, teams]) => ({
    groupName,
    teams: teams.sort(
      (a, b) => b.points - a.points || b.goalDifference - a.goalDifference
    ),
  }));
}

function computeStandingsFromMatches(matches) {
  const groups = new Map();

  matches
    .filter((match) => match.groupName)
    .forEach((match) => {
      if (!groups.has(match.groupName)) groups.set(match.groupName, new Map());
      const group = groups.get(match.groupName);

      [match.homeTeam, match.awayTeam].forEach((team) => {
        if (!group.has(team)) {
          group.set(team, {
            rank: 0,
            team,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0,
            groupName: match.groupName,
          });
        }
      });

      const finished = ["finished", "completed"].includes(
        String(match.status).toLowerCase()
      );
      const hasScore = match.homeScore !== null && match.awayScore !== null;

      if (!finished || !hasScore) return;

      const home = group.get(match.homeTeam);
      const away = group.get(match.awayTeam);
      home.played += 1;
      away.played += 1;
      home.goalsFor += match.homeScore;
      home.goalsAgainst += match.awayScore;
      away.goalsFor += match.awayScore;
      away.goalsAgainst += match.homeScore;

      if (match.homeScore > match.awayScore) {
        home.won += 1;
        away.lost += 1;
        home.points += 3;
      } else if (match.homeScore < match.awayScore) {
        away.won += 1;
        home.lost += 1;
        away.points += 3;
      } else {
        home.drawn += 1;
        away.drawn += 1;
        home.points += 1;
        away.points += 1;
      }

      home.goalDifference = home.goalsFor - home.goalsAgainst;
      away.goalDifference = away.goalsFor - away.goalsAgainst;
    });

  return Array.from(groups.entries()).map(([groupName, teamMap]) => {
    const teams = Array.from(teamMap.values())
      .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor)
      .map((team, index) => ({ ...team, rank: index + 1 }));

    return { groupName, teams };
  });
}

async function getWorldCupStandings() {
  const cacheKey = "world-cup-standings";
  const cached = getCachedValue(cacheKey, MATCH_DAY_TTL_MS);
  if (cached) return cached.data;

  let standings = [];
  let source = "WC2026 API";

  try {
    standings = normalizeStandings(await apiGet("/standings"));
  } catch (error) {
    console.warn("[WorldCup] Standings API fallback:", error.message);
  }

  if (!standings.length) {
    standings = computeStandingsFromMatches(await getAllMatches());
    source = "WC2026 matches fallback";
  }

  const data = {
    groups: standings,
    source,
    updatedAt: new Date().toISOString(),
  };
  cache.set(cacheKey, { at: Date.now(), data });
  return data;
}

function isKnockoutMatch(match) {
  const round = String(match.round || "").toLowerCase();
  return (
    round &&
    !["group", "group_stage", "group stage"].includes(round) &&
    !match.groupName
  );
}

function getRoundOrder(round) {
  const key = String(round || "").toLowerCase();
  if (key.includes("32")) return 1;
  if (key.includes("16")) return 2;
  if (key.includes("quarter")) return 3;
  if (key.includes("semi")) return 4;
  if (key.includes("third")) return 5;
  if (key.includes("final")) return 6;
  return 99;
}

async function getWorldCupBracket() {
  const matches = (await getAllMatches()).filter(isKnockoutMatch);
  const rounds = matches.reduce((acc, match) => {
    const roundName = formatRoundName(match.round);
    acc[roundName] = acc[roundName] || [];
    acc[roundName].push(match);
    return acc;
  }, {});

  return {
    rounds: Object.entries(rounds)
      .map(([round, roundMatches]) => ({
        round,
        order: getRoundOrder(round),
        matches: roundMatches.sort(
          (a, b) => new Date(a.kickoffUtc) - new Date(b.kickoffUtc)
        ),
      }))
      .sort((a, b) => a.order - b.order),
    source: "WC2026 matches",
    updatedAt: new Date().toISOString(),
  };
}

function formatRoundName(round) {
  if (!round) return "Knockout";

  return String(round)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function getWorldCupMatches({ limit = 8 } = {}) {
  const cacheKey = "world-cup-matches";
  const cachedEntry = cache.get(cacheKey);
  const cached = getCached(cacheKey);
  const matches = cached || (await fetchWorldCupMatches());
  const fetchedAt = cached ? cachedEntry.at : Date.now();

  if (!cached) {
    cache.set(cacheKey, { at: fetchedAt, data: matches });
  }

  const now = Date.now();
  const visibleMatches = matches.filter((match) => {
    const kickoff = new Date(match.kickoffUtc).getTime();
    return kickoff >= now - 3 * 60 * 60 * 1000;
  });

  return {
    matches: (visibleMatches.length ? visibleMatches : matches).slice(0, limit),
    source: "WC2026 API",
    updatedAt: new Date(fetchedAt).toISOString(),
    servedAt: new Date(now).toISOString(),
    isCached: Boolean(cached),
    refreshAfterMs: getCacheTtlMs(matches, now),
  };
}

module.exports = {
  getWorldCupMatches,
  getWorldCupStandings,
  getWorldCupBracket,
  fetchWorldCupMatches,
};
