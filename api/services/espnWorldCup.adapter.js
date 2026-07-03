const axios = require("axios");

const ESPN_API_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

// Format date as YYYYMMDD
function getEspnDateString(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

async function fetchEspnScores() {
  try {
    // Fetch today's scores based on Vietnam timezone
    const vnTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });
    const today = getEspnDateString(vnTime);
    
    // Also fetch yesterday and tomorrow to cover timezone overlap edge cases
    const yesterdayDate = new Date(new Date(vnTime).getTime() - 86400000);
    const tomorrowDate = new Date(new Date(vnTime).getTime() + 86400000);
    const yesterday = getEspnDateString(yesterdayDate);
    const tomorrow = getEspnDateString(tomorrowDate);

    // ESPN uses hyphen for date ranges
    const dates = `${yesterday}-${tomorrow}`;

    const { data } = await axios.get(ESPN_API_URL, {
      params: { dates, limit: 100 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: 10000,
    });

    const liveScores = {};

    if (!data || !data.events) return liveScores;

    for (const event of data.events) {
      const competition = event.competitions?.[0];
      if (!competition) continue;

      const homeCompetitor = competition.competitors.find((c) => c.homeAway === "home") || competition.competitors[0];
      const awayCompetitor = competition.competitors.find((c) => c.homeAway === "away") || competition.competitors[1];

      const homeName = homeCompetitor?.team?.name || homeCompetitor?.team?.displayName || "";
      const awayName = awayCompetitor?.team?.name || awayCompetitor?.team?.displayName || "";

      const statusState = competition.status?.type?.state || "pre";
      let mappedStatus = "scheduled";
      if (statusState === "in") {
        mappedStatus = "live";
      } else if (statusState === "post") {
        mappedStatus = "finished";
      }

      liveScores[`${homeName}|||${awayName}`] = {
        homeScore: homeCompetitor?.score !== undefined && homeCompetitor.score !== null ? parseInt(homeCompetitor.score, 10) : null,
        awayScore: awayCompetitor?.score !== undefined && awayCompetitor.score !== null ? parseInt(awayCompetitor.score, 10) : null,
        status: mappedStatus,
        elapsed: competition.status?.displayClock || null,
        statusShort: competition.status?.type?.shortDetail || "",
      };
    }

    return liveScores;
  } catch (error) {
    console.error("[ESPN Adapter] Failed to fetch scores:", error.message);
    return {};
  }
}

// Helper to fuzzy match team names since ESPN and worldcup26.ir might differ slightly
function fuzzyMatchTeam(teamA, teamB) {
  const normalize = (t) => t.toLowerCase().replace(/[^a-z]/g, "");
  const a = normalize(teamA);
  const b = normalize(teamB);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // Common aliases
  if ((a === "usa" && b === "unitedstates") || (b === "usa" && a === "unitedstates")) return true;
  if ((a === "southkorea" && b === "korearepublic") || (b === "southkorea" && a === "korearepublic")) return true;
  if ((a === "netherlands" && b === "holland") || (b === "netherlands" && a === "holland")) return true;
  return false;
}

function mergeEspnScores(matches, espnMap) {
  if (!espnMap || !Object.keys(espnMap).length) return matches;

  const espnEntries = Object.entries(espnMap);

  return matches.map((match) => {
    // Exact match first
    const exactKey = `${match.homeTeam}|||${match.awayTeam}`;
    let live = espnMap[exactKey];

    // If no exact match, try fuzzy match
    if (!live) {
      for (const [key, data] of espnEntries) {
        const [espnHome, espnAway] = key.split("|||");
        if (fuzzyMatchTeam(match.homeTeam, espnHome) && fuzzyMatchTeam(match.awayTeam, espnAway)) {
          live = data;
          break;
        }
      }
    }

    if (live) {
      return {
        ...match,
        // Override status only if ESPN says it's live or finished
        // We trust ESPN more than the worldcup26 API
        status: live.status !== "scheduled" ? live.status : match.status,
        homeScore: live.homeScore !== null && !isNaN(live.homeScore) ? live.homeScore : match.homeScore,
        awayScore: live.awayScore !== null && !isNaN(live.awayScore) ? live.awayScore : match.awayScore,
        elapsed: live.elapsed,
      };
    }
    return match;
  });
}

module.exports = {
  fetchEspnScores,
  mergeEspnScores,
};
