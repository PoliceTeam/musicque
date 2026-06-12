const axios = require("axios");

const BASE_URL = "https://worldcup26.ir";

const LIVE_TTL_MS = 30 * 1000;
const MATCH_DAY_TTL_MS = 5 * 60 * 1000;
const DEFAULT_TTL_MS = 30 * 60 * 1000;
const NEAR_MATCH_MS = 6 * 60 * 60 * 1000;
const LOOKUP_TTL_MS = 60 * 60 * 1000; // 1 hour for teams/stadiums
const cache = new Map();

async function apiGet(path) {
  const { data } = await axios.get(`${BASE_URL}${path}`, {
    timeout: 15000,
  });
  return data;
}

// ── Lookup helpers (teams & stadiums) ──────────────────────────────

async function getTeamsLookup() {
  const cacheKey = "wc-teams-lookup";
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < LOOKUP_TTL_MS) return cached.data;

  try {
    const raw = await apiGet("/get/teams");
    const teams = raw.teams || raw || [];
    const lookup = {};
    for (const t of teams) {
      lookup[String(t.id)] = {
        name: t.name_en || t.name || `Team ${t.id}`,
        code: t.fifa_code || t.iso2 || "",
        flag: t.flag || "",
        group: t.groups || "",
      };
    }
    cache.set(cacheKey, { at: Date.now(), data: lookup });
    return lookup;
  } catch (err) {
    console.warn("[WorldCup] Failed to fetch teams:", err.message);
    return cached?.data || {};
  }
}

async function getStadiumsLookup() {
  const cacheKey = "wc-stadiums-lookup";
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < LOOKUP_TTL_MS) return cached.data;

  try {
    const raw = await apiGet("/get/stadiums");
    const stadiums = raw.stadiums || raw || [];
    const lookup = {};
    for (const s of stadiums) {
      lookup[String(s.id)] = {
        name: s.name_en || s.fifa_name || `Stadium ${s.id}`,
        city: s.city_en || "",
        country: s.country_en || "",
        region: s.region || "",
      };
    }
    cache.set(cacheKey, { at: Date.now(), data: lookup });
    return lookup;
  } catch (err) {
    console.warn("[WorldCup] Failed to fetch stadiums:", err.message);
    return cached?.data || {};
  }
}

// ── Status & date helpers ──────────────────────────────────────────

function isLiveStatus(status) {
  return [
    "live",
    "in_progress",
    "first_half",
    "second_half",
    "halftime",
  ].includes(String(status).toLowerCase());
}

const GROUP_LETTERS = new Set([
  "A","B","C","D","E","F","G","H","I","J","K","L",
]);

function isGroupStage(match) {
  const type = String(match.type || "").toLowerCase();
  if (type === "group") return true;
  const group = String(match.group || "");
  return GROUP_LETTERS.has(group);
}

function mapStatus(timeElapsed, finished) {
  if (String(finished).toUpperCase() === "TRUE") return "finished";
  if (!timeElapsed || timeElapsed === "notstarted") return "scheduled";
  return "live";
}

function isSameVietnamDate(timestamp, now) {
  if (!timestamp) return false;
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
  if (matches.some((m) => isLiveStatus(m.status))) return LIVE_TTL_MS;

  const hasNearMatch = matches.some((m) => {
    if (!m.kickoffUtc) return false;
    const kickoff = new Date(m.kickoffUtc).getTime();
    return kickoff >= now - 3 * 60 * 60 * 1000 && kickoff <= now + NEAR_MATCH_MS;
  });
  if (hasNearMatch) return 60 * 1000;

  const hasMatchToday = matches.some((m) => {
    if (!m.kickoffUtc) return false;
    return isSameVietnamDate(new Date(m.kickoffUtc).getTime(), now);
  });
  return hasMatchToday ? MATCH_DAY_TTL_MS : DEFAULT_TTL_MS;
}

function getCached(key) {
  const cached = cache.get(key);
  if (!cached) return null;
  const ttlMs = getCacheTtlMs(cached.data);
  if (Date.now() - cached.at < ttlMs) return cached.data;
  return null;
}

function getCachedValue(key, ttlMs) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < ttlMs) return cached;
  return null;
}

// ── Timezone & date parsing ────────────────────────────────────────
// local_date from API = local time at the stadium venue.
// We convert to real UTC using the stadium's summer-time UTC offset.

function getUtcOffsetHours(stadiumInfo) {
  if (!stadiumInfo) return 0;
  const country = (stadiumInfo.country || "").toLowerCase();
  const region = (stadiumInfo.region || "").toLowerCase();

  // Mexico venues are all CDT (UTC-5) during World Cup (June-July)
  if (country.includes("mexico")) return -5;

  // Map by region (all summer / daylight saving time)
  if (region === "eastern") return -4;   // EDT (US Eastern + Toronto)
  if (region === "central") return -5;   // CDT (US Central)
  if (region === "western") return -7;   // PDT (US Pacific + Vancouver)

  return 0; // fallback
}

function parseLocalDate(localDateStr, utcOffsetHours = 0) {
  if (!localDateStr) return null;
  const [datePart, timePart] = localDateStr.split(" ");
  if (!datePart || !timePart) return null;
  const [month, day, year] = datePart.split("/");
  const [hour, minute] = timePart.split(":");
  if (!year || !month || !day) return null;

  // Parse as local time, then subtract offset to get actual UTC
  const localMs = Date.UTC(
    Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)
  );
  const utcMs = localMs - utcOffsetHours * 60 * 60 * 1000;
  return new Date(utcMs).toISOString();
}

function toVietnamTime(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  return date.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ── Match normalizer ──────────────────────────────────────────────

function normalizeMatch(match, teamsLookup, stadiumsLookup) {
  const groupStage = isGroupStage(match);
  const groupLetter = String(match.group || "");

  // Resolve team names
  const homeId = String(match.home_team_id || "");
  const awayId = String(match.away_team_id || "");
  const homeTeamInfo = teamsLookup[homeId];
  const awayTeamInfo = teamsLookup[awayId];

  let homeTeam, awayTeam;
  if (homeTeamInfo && homeId !== "0") {
    homeTeam = homeTeamInfo.name;
  } else {
    homeTeam = match.home_team_label || "TBD";
  }
  if (awayTeamInfo && awayId !== "0") {
    awayTeam = awayTeamInfo.name;
  } else {
    awayTeam = match.away_team_label || "TBD";
  }

  // Resolve stadium
  const stadiumId = String(match.stadium_id || "");
  const stadiumInfo = stadiumsLookup[stadiumId];

  // Parse kickoff time first (needed for smart status)
  const utcOffset = getUtcOffsetHours(stadiumInfo);
  const kickoffUtc = parseLocalDate(match.local_date, utcOffset);

  // Determine status — with smart live inference
  // The open-source API may be slow to update `time_elapsed`,
  // so if kickoff has passed but API still says "notstarted", infer "live".
  let status = mapStatus(match.time_elapsed, match.finished);
  if (status === "scheduled" && kickoffUtc) {
    const now = Date.now();
    const kickoffMs = new Date(kickoffUtc).getTime();
    const MATCH_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours max
    if (now >= kickoffMs && now <= kickoffMs + MATCH_DURATION_MS) {
      status = "live";
    }
  }

  // Only show scores for live or finished matches
  let homeScore = null;
  let awayScore = null;
  if (status === "finished" || status === "live") {
    const hs = match.home_score;
    const as = match.away_score;
    homeScore = (hs !== undefined && hs !== null && hs !== "null") ? parseInt(hs, 10) : null;
    awayScore = (as !== undefined && as !== null && as !== "null") ? parseInt(as, 10) : null;
  }

  // Build round name
  let round;
  if (groupStage) {
    round = `Group ${groupLetter}`;
  } else {
    round = formatRoundName(groupLetter);
  }

  return {
    id: match.id,
    matchNumber: match.id,
    round,
    groupName: groupStage ? `Group ${groupLetter}` : null,
    homeTeam,
    awayTeam,
    stadium: stadiumInfo?.name || `Stadium ${stadiumId}`,
    city: stadiumInfo?.city || "",
    country: stadiumInfo?.country || "",
    kickoffUtc,
    kickoffVietnam: toVietnamTime(kickoffUtc),
    status,
    homeScore,
    awayScore,
  };
}

// ── Core fetchers ─────────────────────────────────────────────────

// Fetch live scores from API-Football (free tier: 100 req/day)
const LIVE_API_URL = "https://v3.football.api-sports.io";
const LIVE_API_KEY = process.env.WC2026_API_KEY;
const LIVE_SCORE_TTL_MS = 30 * 1000; // refresh live scores every 30s

const persistentScores = {};

async function fetchLiveScores() {
  const cacheKey = "wc-live-scores";
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < LIVE_SCORE_TTL_MS) return cached.data;

  if (!LIVE_API_KEY) return persistentScores;

  try {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await axios.get(`${LIVE_API_URL}/fixtures`, {
      params: { date: today },
      headers: {
        "x-apisports-key": LIVE_API_KEY,
        Accept: "application/json",
      },
      timeout: 10000,
    });

    // Filter only World Cup matches
    const wcMatches = (data.response || []).filter(
      (m) => (m.league?.name || "").toLowerCase().includes("world cup")
    );

    for (const m of wcMatches) {
      const homeName = m.teams?.home?.name || "";
      const awayName = m.teams?.away?.name || "";
      const key = `${homeName}|||${awayName}`;
      
      const statusShort = m.fixture?.status?.short || "";
      let mappedStatus = "scheduled";
      if (["1H", "2H", "HT", "ET", "P", "LIVE"].includes(statusShort)) {
        mappedStatus = "live";
      } else if (["FT", "AET", "PEN"].includes(statusShort)) {
        mappedStatus = "finished";
      }

      persistentScores[key] = {
        homeScore: m.goals?.home ?? null,
        awayScore: m.goals?.away ?? null,
        status: mappedStatus,
        elapsed: m.fixture?.status?.elapsed || null,
        statusShort: statusShort,
      };
    }

    cache.set(cacheKey, { at: Date.now(), data: persistentScores });
    return persistentScores;
  } catch (err) {
    console.warn("[WorldCup] Live scores fetch error:", err.message);
    return persistentScores;
  }
}

function mergeWithLiveScores(matches, liveMap) {
  if (!liveMap || !Object.keys(liveMap).length) return matches;

  return matches.map((match) => {
    const key = `${match.homeTeam}|||${match.awayTeam}`;
    const live = liveMap[key];
    if (live) {
      return {
        ...match,
        status: live.status,
        homeScore: live.homeScore,
        awayScore: live.awayScore,
        elapsed: live.elapsed,
      };
    }
    return match;
  });
}

async function fetchWorldCupMatches() {
  const [gamesData, teamsLookup, stadiumsLookup] = await Promise.all([
    apiGet("/get/games"),
    getTeamsLookup(),
    getStadiumsLookup(),
  ]);

  const matchesData = gamesData.games || gamesData.data || gamesData || [];

  let matches = (Array.isArray(matchesData) ? matchesData : [])
    .map((m) => normalizeMatch(m, teamsLookup, stadiumsLookup))
    .filter((m) => m.kickoffUtc)
    .sort((a, b) => new Date(a.kickoffUtc) - new Date(b.kickoffUtc));

  // Merge real-time live scores from API-Football
  try {
    const liveMap = await fetchLiveScores();
    matches = mergeWithLiveScores(matches, liveMap);
  } catch (err) {
    console.warn("[WorldCup] Failed to merge live scores:", err.message);
  }

  return matches;
}

async function getAllMatches() {
  const cacheKey = "world-cup-matches";
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const matches = await fetchWorldCupMatches();
  cache.set(cacheKey, { at: Date.now(), data: matches });
  return matches;
}

// ── Standings ─────────────────────────────────────────────────────

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

      const finished = match.status === "finished";
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

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([groupName, teamMap]) => {
      const teams = Array.from(teamMap.values())
        .sort(
          (a, b) =>
            b.points - a.points ||
            b.goalDifference - a.goalDifference ||
            b.goalsFor - a.goalsFor
        )
        .map((team, index) => ({ ...team, rank: index + 1 }));
      return { groupName, teams };
    });
}

async function getWorldCupStandings() {
  const cacheKey = "world-cup-standings";
  const cached = getCachedValue(cacheKey, MATCH_DAY_TTL_MS);
  if (cached) return cached.data;

  const standings = computeStandingsFromMatches(await getAllMatches());

  const data = {
    groups: standings,
    source: "worldcup26.ir",
    updatedAt: new Date().toISOString(),
  };
  cache.set(cacheKey, { at: Date.now(), data });
  return data;
}

// ── Bracket / knockout ────────────────────────────────────────────

function isKnockoutMatch(match) {
  return !match.groupName;
}

function getRoundOrder(round) {
  const key = String(round || "").toLowerCase();
  if (key.includes("32") || key.includes("r32")) return 1;
  if (key.includes("16") || key.includes("r16")) return 2;
  if (key.includes("quarter") || key.includes("qf")) return 3;
  if (key.includes("semi") || key.includes("sf")) return 4;
  if (key.includes("third") || key.includes("3rd")) return 5;
  if (key.includes("final")) return 6;
  return 99;
}

async function getWorldCupBracket() {
  const matches = (await getAllMatches()).filter(isKnockoutMatch);
  const rounds = matches.reduce((acc, match) => {
    const roundName = match.round;
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
    source: "worldcup26.ir",
    updatedAt: new Date().toISOString(),
  };
}

function formatRoundName(round) {
  if (!round) return "Knockout";
  const key = round.toUpperCase();
  const map = {
    R32: "Round of 32",
    R16: "Round of 16",
    QF: "Quarter-finals",
    SF: "Semi-finals",
    "3RD": "Third Place",
    FINAL: "Final",
  };
  return map[key] || key;
}

// ── Public API ─────────────────────────────────────────────────────

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

  return {
    matches: matches.slice(0, limit),
    source: "worldcup26.ir",
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
