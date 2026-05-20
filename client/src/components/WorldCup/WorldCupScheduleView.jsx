import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Alert,
  Card,
  Empty,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Table,
  Typography,
} from "antd";
import {
  CalendarOutlined,
  ReloadOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import {
  getWorldCupBracket,
  getWorldCupMatches,
  getWorldCupStandings,
} from "../../services/api";
import { PlaylistContext } from "../../contexts/PlaylistContext";
import { useTheme } from "../../contexts/ThemeContext";
import BroadcastMatchCard from "./MatchCard";
import MatchDetailModal from "./MatchDetailModal";
import "./WorldCup.css";

const { Text } = Typography;

export const TEAM_FLAGS = {
  Albania: "🇦🇱",
  Algeria: "🇩🇿",
  Andorra: "🇦🇩",
  Angola: "🇦🇴",
  Argentina: "🇦🇷",
  Armenia: "🇦🇲",
  Australia: "🇦🇺",
  Austria: "🇦🇹",
  Azerbaijan: "🇦🇿",
  Bahrain: "🇧🇭",
  Belarus: "🇧🇾",
  Belgium: "🇧🇪",
  Benin: "🇧🇯",
  Bolivia: "🇧🇴",
  Brazil: "🇧🇷",
  Bulgaria: "🇧🇬",
  "Burkina Faso": "🇧🇫",
  Cambodia: "🇰🇭",
  Cameroon: "🇨🇲",
  Canada: "🇨🇦",
  "Cape Verde": "🇨🇻",
  Chile: "🇨🇱",
  China: "🇨🇳",
  "China PR": "🇨🇳",
  "Chinese Taipei": "🇹🇼",
  Colombia: "🇨🇴",
  "Costa Rica": "🇨🇷",
  "Côte d'Ivoire": "🇨🇮",
  Croatia: "🇭🇷",
  Cuba: "🇨🇺",
  "Curaçao": "🇨🇼",
  Cyprus: "🇨🇾",
  "Czech Republic": "🇨🇿",
  Czechia: "🇨🇿",
  Denmark: "🇩🇰",
  "DR Congo": "🇨🇩",
  Ecuador: "🇪🇨",
  Egypt: "🇪🇬",
  "El Salvador": "🇸🇻",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Estonia: "🇪🇪",
  "Faroe Islands": "🇫🇴",
  Fiji: "🇫🇯",
  Finland: "🇫🇮",
  France: "🇫🇷",
  Georgia: "🇬🇪",
  Germany: "🇩🇪",
  Ghana: "🇬🇭",
  Gibraltar: "🇬🇮",
  Greece: "🇬🇷",
  Guatemala: "🇬🇹",
  Guinea: "🇬🇳",
  Haiti: "🇭🇹",
  Honduras: "🇭🇳",
  "Hong Kong": "🇭🇰",
  Hungary: "🇭🇺",
  Iceland: "🇮🇸",
  India: "🇮🇳",
  Indonesia: "🇮🇩",
  Iran: "🇮🇷",
  "IR Iran": "🇮🇷",
  Iraq: "🇮🇶",
  Ireland: "🇮🇪",
  Israel: "🇮🇱",
  Italy: "🇮🇹",
  "Ivory Coast": "🇨🇮",
  Jamaica: "🇯🇲",
  Japan: "🇯🇵",
  Jordan: "🇯🇴",
  Kazakhstan: "🇰🇿",
  Kenya: "🇰🇪",
  "Korea DPR": "🇰🇵",
  "Korea Republic": "🇰🇷",
  Kosovo: "🇽🇰",
  Kuwait: "🇰🇼",
  Kyrgyzstan: "🇰🇬",
  Laos: "🇱🇦",
  Latvia: "🇱🇻",
  Lebanon: "🇱🇧",
  Libya: "🇱🇾",
  Liechtenstein: "🇱🇮",
  Lithuania: "🇱🇹",
  Luxembourg: "🇱🇺",
  Madagascar: "🇲🇬",
  Malaysia: "🇲🇾",
  Mali: "🇲🇱",
  Malta: "🇲🇹",
  Mauritania: "🇲🇷",
  Mexico: "🇲🇽",
  Moldova: "🇲🇩",
  Montenegro: "🇲🇪",
  Morocco: "🇲🇦",
  Mozambique: "🇲🇿",
  Myanmar: "🇲🇲",
  Namibia: "🇳🇦",
  Netherlands: "🇳🇱",
  "New Caledonia": "🇳🇨",
  "New Zealand": "🇳🇿",
  Nigeria: "🇳🇬",
  "North Korea": "🇰🇵",
  "North Macedonia": "🇲🇰",
  "Northern Ireland": "🏴\u200d󠁵󠁳󠁮󠁩\u200d󠁿",
  Norway: "🇳🇴",
  Oman: "🇴🇲",
  Palestine: "🇵🇸",
  Panama: "🇵🇦",
  "Papua New Guinea": "🇵🇬",
  Paraguay: "🇵🇾",
  Peru: "🇵🇪",
  Philippines: "🇵🇭",
  Poland: "🇵🇱",
  Portugal: "🇵🇹",
  Qatar: "🇶🇦",
  "Republic of Ireland": "🇮🇪",
  Romania: "🇷🇴",
  "San Marino": "🇸🇲",
  "Saudi Arabia": "🇸🇦",
  Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  Senegal: "🇸🇳",
  Serbia: "🇷🇸",
  Singapore: "🇸🇬",
  Slovakia: "🇸🇰",
  Slovenia: "🇸🇮",
  "Solomon Islands": "🇸🇧",
  "South Africa": "🇿🇦",
  "South Korea": "🇰🇷",
  Spain: "🇪🇸",
  Sweden: "🇸🇪",
  Switzerland: "🇨🇭",
  Syria: "🇸🇾",
  Tahiti: "🇵🇫",
  Tajikistan: "🇹🇯",
  Thailand: "🇹🇭",
  Togo: "🇹🇬",
  "Trinidad and Tobago": "🇹🇹",
  Tunisia: "🇹🇳",
  Turkey: "🇹🇷",
  Türkiye: "🇹🇷",
  UAE: "🇦🇪",
  Uganda: "🇺🇬",
  Ukraine: "🇺🇦",
  "United Arab Emirates": "🇦🇪",
  "United States": "🇺🇸",
  Uruguay: "🇺🇾",
  USA: "🇺🇸",
  Uzbekistan: "🇺🇿",
  Vanuatu: "🇻🇺",
  Venezuela: "🇻🇪",
  Vietnam: "🇻🇳",
  Wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  Yemen: "🇾🇪",
  Zambia: "🇿🇲",
  Zimbabwe: "🇿🇼",
};

export const TEAM_FLAG_CODES = {
  Albania: "al",
  Algeria: "dz",
  Andorra: "ad",
  Angola: "ao",
  Argentina: "ar",
  Armenia: "am",
  Australia: "au",
  Austria: "at",
  Azerbaijan: "az",
  Bahrain: "bh",
  Belarus: "by",
  Belgium: "be",
  Benin: "bj",
  Bolivia: "bo",
  "Bosnia-Herzegovina": "ba",
  "Bosnia and Herzegovina": "ba",
  Bosnia: "ba",
  Brazil: "br",
  Bulgaria: "bg",
  "Burkina Faso": "bf",
  Cambodia: "kh",
  Cameroon: "cm",
  Canada: "ca",
  "Cape Verde": "cv",
  Chile: "cl",
  China: "cn",
  "China PR": "cn",
  "Chinese Taipei": "tw",
  Colombia: "co",
  "Costa Rica": "cr",
  "Côte d'Ivoire": "ci",
  "Ivory Coast": "ci",
  Croatia: "hr",
  Cuba: "cu",
  "Curaçao": "cw",
  Cyprus: "cy",
  "Czech Republic": "cz",
  Czechia: "cz",
  Denmark: "dk",
  "DR Congo": "cd",
  "Congo DR": "cd",
  Ecuador: "ec",
  Egypt: "eg",
  "El Salvador": "sv",
  England: "gb-eng",
  Estonia: "ee",
  "Faroe Islands": "fo",
  Fiji: "fj",
  Finland: "fi",
  France: "fr",
  Georgia: "ge",
  Germany: "de",
  Ghana: "gh",
  Gibraltar: "gi",
  Greece: "gr",
  Guatemala: "gt",
  Guinea: "gn",
  Haiti: "ht",
  Honduras: "hn",
  "Hong Kong": "hk",
  Hungary: "hu",
  Iceland: "is",
  India: "in",
  Indonesia: "id",
  Iran: "ir",
  "IR Iran": "ir",
  Iraq: "iq",
  Ireland: "ie",
  "Republic of Ireland": "ie",
  Israel: "il",
  Italy: "it",
  Japan: "jp",
  Jordan: "jo",
  Kazakhstan: "kz",
  Kenya: "ke",
  "Korea DPR": "kp",
  "North Korea": "kp",
  "Korea Republic": "kr",
  "South Korea": "kr",
  Kosovo: "xk",
  Kuwait: "kw",
  Kyrgyzstan: "kg",
  Laos: "la",
  Latvia: "lv",
  Lebanon: "lb",
  Libya: "ly",
  Liechtenstein: "li",
  Lithuania: "lt",
  Luxembourg: "lu",
  Madagascar: "mg",
  Malaysia: "my",
  Mali: "ml",
  Malta: "mt",
  Mauritania: "mr",
  Mexico: "mx",
  Moldova: "md",
  Montenegro: "me",
  Morocco: "ma",
  Mozambique: "mz",
  Myanmar: "mm",
  Namibia: "na",
  Netherlands: "nl",
  "New Caledonia": "nc",
  "New Zealand": "nz",
  Nigeria: "ng",
  "North Macedonia": "mk",
  "Northern Ireland": "gb-nir",
  Norway: "no",
  Oman: "om",
  Palestine: "ps",
  Panama: "pa",
  "Papua New Guinea": "pg",
  Paraguay: "py",
  Peru: "pe",
  Philippines: "ph",
  Poland: "pl",
  Portugal: "pt",
  Qatar: "qa",
  Romania: "ro",
  "San Marino": "sm",
  "Saudi Arabia": "sa",
  Scotland: "gb-sct",
  Senegal: "sn",
  Serbia: "rs",
  Singapore: "sg",
  Slovakia: "sk",
  Slovenia: "si",
  "Solomon Islands": "sb",
  "South Africa": "za",
  Spain: "es",
  Sweden: "se",
  Switzerland: "ch",
  Syria: "sy",
  Tahiti: "pf",
  Tajikistan: "tj",
  Thailand: "th",
  Togo: "tg",
  "Trinidad and Tobago": "tt",
  Tunisia: "tn",
  Turkey: "tr",
  Türkiye: "tr",
  UAE: "ae",
  "United Arab Emirates": "ae",
  Uganda: "ug",
  Ukraine: "ua",
  Uruguay: "uy",
  USA: "us",
  "United States": "us",
  Uzbekistan: "uz",
  Vanuatu: "vu",
  Venezuela: "ve",
  Vietnam: "vn",
  Wales: "gb-wls",
  Yemen: "ye",
  Zambia: "zm",
  Zimbabwe: "zw",
};

export const STATUS_MAP = {
  scheduled: { color: "processing", label: "Sắp đá" },
  live: { color: "red", label: "Đang đá" },
  in_progress: { color: "red", label: "Đang đá" },
  first_half: { color: "red", label: "Đang đá (Hiệp 1)" },
  second_half: { color: "red", label: "Đang đá (Hiệp 2)" },
  halftime: { color: "red", label: "Nghỉ giữa hiệp" },
  finished: { color: "default", label: "Đã xong" },
  completed: { color: "default", label: "Đã xong" },
};

export const formatRound = (match) => {
  if (match.groupName) return `Bảng ${match.groupName}`;
  if (!match.round) return "World Cup 2026";

  return String(match.round)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const formatKickoff = (kickoffUtc) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(kickoffUtc));

const formatKickoffDate = (kickoffUtc) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(kickoffUtc));

const formatUpdatedAt = (updatedAt) => {
  if (!updatedAt) return "N/A";

  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(updatedAt));
};

const formatRefreshInterval = (milliseconds) => {
  if (!milliseconds) return "tự động";

  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;

  return `${Math.round(seconds / 60)} phút`;
};

export const normalizeTeamName = (teamName = "") =>
  String(teamName)
    .trim()
    .replace(/\s+/g, " ")
    .replace("Bosnia Herzegovina", "Bosnia and Herzegovina")
    .replace("Cabo Verde", "Cape Verde");

export const getTeamFlag = (teamName) => {
  const norm = normalizeTeamName(teamName);
  if (!norm || norm.toUpperCase() === "TBD") return "🏳️";
  return TEAM_FLAGS[norm] || "";
};
export const getTeamFlagUrl = (teamName) => {
  const normalizedName = normalizeTeamName(teamName);
  const code = TEAM_FLAG_CODES[normalizedName];
  return code ? `https://flagcdn.com/${code}.svg` : null;
};

export const getTeamAbbreviation = (name = "") => {
  if (!name || name === "TBD") return "TBD";
  const cleanName = name.replace(/[^a-zA-Z\s]/g, "").trim();
  const words = cleanName.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return cleanName.substring(0, 3).toUpperCase();
};

export const getGroupLabel = (match) => {
  if (match.groupName) return `Bảng ${match.groupName}`;
  if (String(match.round || "").toLowerCase().includes("group")) {
    return "Vòng bảng";
  }

  return formatRound(match);
};

export const isLiveMatch = (match) =>
  ["live", "in_progress", "first_half", "second_half", "halftime"].includes(
    String(match.status).toLowerCase()
  );

const isTodayMatch = (match) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    formatter.format(new Date(match.kickoffUtc)) ===
    formatter.format(new Date())
  );
};

const groupMatchesByDate = (matches) =>
  matches.reduce((acc, match) => {
    const key = formatKickoffDate(match.kickoffUtc);
    acc[key] = acc[key] || [];
    acc[key].push(match);
    return acc;
  }, {});

const groupMatchesByGroup = (matches) =>
  matches.reduce((acc, match) => {
    const key = getGroupLabel(match);
    acc[key] = acc[key] || [];
    acc[key].push(match);
    return acc;
  }, {});

const WorldCupScheduleView = () => {
  const { isDark } = useTheme();
  const { socket } = useContext(PlaylistContext);
  const railRef = useRef(null);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [standings, setStandings] = useState(null);
  const [bracket, setBracket] = useState(null);

  const fetchTournamentDetails = async () => {
    const [standingsResult, bracketResult] = await Promise.allSettled([
      getWorldCupStandings(),
      getWorldCupBracket(),
    ]);

    if (standingsResult.status === "fulfilled") {
      setStandings(standingsResult.value.data.data);
    }

    if (bracketResult.status === "fulfilled") {
      setBracket(bracketResult.value.data.data);
    }
  };

  const fetchSchedule = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await getWorldCupMatches(104);
      setSchedule(response.data.data);
      fetchTournamentDetails();
    } catch (err) {
      console.error("Error fetching World Cup schedule:", err);
      if (!silent || !schedule) {
        setError(
          err.response?.data?.error ||
            err.response?.data?.message ||
            "Không thể lấy lịch thi đấu World Cup"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    const handleScheduleUpdate = (nextSchedule) => {
      setSchedule(nextSchedule);
      setError(null);
      fetchTournamentDetails();
    };

    socket.on("world_cup_schedule_updated", handleScheduleUpdate);

    return () => {
      socket.off("world_cup_schedule_updated", handleScheduleUpdate);
    };
  }, [socket]);

  useEffect(() => {
    if (!schedule?.refreshAfterMs) return undefined;

    const timer = window.setTimeout(() => {
      fetchSchedule({ silent: true });
    }, schedule.refreshAfterMs);

    return () => window.clearTimeout(timer);
  }, [schedule?.refreshAfterMs, schedule?.servedAt]);

  if (loading && !schedule) {
    return (
      <Card title="Lịch thi đấu World Cup" style={{ height: "100%" }}>
        <div style={{ textAlign: "center", padding: "20px" }}>
          <Spin size="large" />
          <div style={{ marginTop: "16px" }}>
            <Text type="secondary">Đang tải lịch thi đấu...</Text>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Lịch thi đấu World Cup" style={{ height: "100%" }}>
        <Alert
          message="Lỗi tải dữ liệu"
          description={error}
          type="error"
          showIcon
          action={
            <ReloadOutlined
              onClick={fetchSchedule}
              style={{ cursor: "pointer" }}
            />
          }
        />
      </Card>
    );
  }

  const matches = schedule?.matches || [];
  const liveMatches = matches.filter(isLiveMatch);
  const totalTeams = new Set(
    matches
      .flatMap((match) => [match.homeTeam, match.awayTeam])
      .filter((team) => team && team !== "TBD")
  ).size;
  const groupOptions = Array.from(
    new Set(matches.map(getGroupLabel).filter(Boolean))
  ).map((group) => ({ label: group, value: group }));
  const filteredMatches =
    selectedGroup === "all"
      ? matches
      : matches.filter((match) => getGroupLabel(match) === selectedGroup);
  const dateGroups = groupMatchesByDate(filteredMatches);
  const stageGroups = groupMatchesByGroup(matches);
  const standingsGroups = standings?.groups || [];
  const bracketRounds = bracket?.rounds || [];

  const renderHorizontalRail = (items) => {
    if (!items.length) {
      return (
        <div className="wc-empty">
          <Empty description="Không có trận phù hợp" />
        </div>
      );
    }

    return (
      <div ref={railRef} className="wc-rail">
        {items.map((match) => (
          <div
            key={`${match.id}-${match.kickoffUtc}`}
            className="wc-rail-item"
          >
            <BroadcastMatchCard
              match={match}
              status={STATUS_MAP[String(match.status).toLowerCase()] || STATUS_MAP.scheduled}
              isLive={isLiveMatch(match)}
              hasScore={match.homeScore !== null && match.awayScore !== null}
              getTeamFlag={getTeamFlag}
              getTeamFlagUrl={getTeamFlagUrl}
              getGroupLabel={getGroupLabel}
              formatKickoff={formatKickoff}
              onSelect={setSelectedMatch}
            />
          </div>
        ))}
      </div>
    );
  };

  const scheduleTab = (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div className="wc-filter-row">
        <div className="wc-filter-label">Bộ lọc bảng/vòng</div>
        <div className="wc-pill-filter" role="tablist" aria-label="Lọc lịch đấu theo bảng hoặc vòng">
          {[{ label: "Tất cả", value: "all" }, ...groupOptions].map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={selectedGroup === option.value}
              className={`wc-pill ${selectedGroup === option.value ? "is-active" : ""}`}
              onClick={() => setSelectedGroup(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Select
          className="wc-filter-select"
          size="small"
          value={selectedGroup}
          onChange={setSelectedGroup}
          options={[{ label: "Tất cả bảng/vòng", value: "all" }, ...groupOptions]}
        />
      </div>

      {Object.entries(dateGroups).map(([dateLabel, dayMatches]) => (
        <div
          key={dateLabel}
          className="wc-day-section"
        >
          <div className="wc-date-head" style={{ marginBottom: 10 }}>
            <Text strong>{dateLabel}</Text>
            <Tag style={{ margin: 0 }}>{dayMatches.length} trận</Tag>
          </div>
          {renderHorizontalRail(dayMatches)}
        </div>
      ))}
    </Space>
  );

  const standingsColumns = [
    {
      title: "#",
      dataIndex: "rank",
      width: 44,
      render: (rank) =>
        rank > 0 && rank <= 2 ? (
          <Tag color="blue" style={{ margin: 0 }}>
            {rank}
          </Tag>
        ) : (
          <Text type="secondary">{rank || "-"}</Text>
        ),
    },
    {
      title: "Đội",
      dataIndex: "team",
      render: (team) => {
        const flagUrl = getTeamFlagUrl(team);
        const emoji = getTeamFlag(team);
        return (
          <Space size={8}>
            <span
              className="wc-flag"
              style={{
                width: "24px",
                height: "24px",
                fontSize: emoji ? "14px" : "8px",
                boxShadow: "none",
                background: emoji ? "transparent" : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"),
              }}
            >
              {flagUrl ? (
                <img
                  src={flagUrl}
                  alt={`${team} flag`}
                  style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                />
              ) : emoji ? (
                emoji
              ) : (
                <span className="wc-flag-txt" style={{ fontSize: "8px" }}>
                  {getTeamAbbreviation(team)}
                </span>
              )}
            </span>
            <Text strong>{team}</Text>
          </Space>
        );
      },
    },
    { title: "Tr", dataIndex: "played", width: 48, align: "center" },
    { title: "T", dataIndex: "won", width: 44, align: "center" },
    { title: "H", dataIndex: "drawn", width: 44, align: "center" },
    { title: "B", dataIndex: "lost", width: 44, align: "center" },
    {
      title: "HS",
      dataIndex: "goalDifference",
      width: 52,
      align: "center",
      render: (value) => (
        <span
          className={
            value > 0 ? "wc-gd-positive" : value < 0 ? "wc-gd-negative" : ""
          }
        >
          {value > 0 ? `+${value}` : value}
        </span>
      ),
    },
    {
      title: "Đ",
      dataIndex: "points",
      width: 52,
      align: "center",
      render: (points) => <Text strong>{points}</Text>,
    },
  ];

  const standingsTab = standingsGroups.length ? (
    <div className="wc-standings-grid">
      {standingsGroups.map((group) => (
        <div
          key={group.groupName}
          className="wc-standings-card"
        >
          <div className="wc-section-head" style={{ marginBottom: 10 }}>
            <Text strong>Bảng {group.groupName}</Text>
            <Tag color="blue" style={{ margin: 0 }}>
              Qualified
            </Tag>
          </div>
          <Table
            rowKey={(row) => `${group.groupName}-${row.team}`}
            size="small"
            columns={standingsColumns}
            dataSource={group.teams}
            pagination={false}
            scroll={{ x: 520 }}
          />
        </div>
      ))}
    </div>
  ) : (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "14px",
      }}
    >
      {Object.entries(stageGroups).map(([groupLabel, groupMatches]) => (
        <div
          key={groupLabel}
          style={{
            border: isDark
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid rgba(22,119,255,0.12)",
            borderRadius: "8px",
            padding: "12px",
            background: isDark ? "#1f1f1f" : "#fbfdff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <Text strong>{groupLabel}</Text>
            <Tag style={{ margin: 0 }}>{groupMatches.length} trận</Tag>
          </div>
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            {groupMatches.map((match) => (
              <BroadcastMatchCard
                key={`${match.id}-${match.kickoffUtc}`}
                match={match}
                status={STATUS_MAP[String(match.status).toLowerCase()] || STATUS_MAP.scheduled}
                isLive={isLiveMatch(match)}
                hasScore={match.homeScore !== null && match.awayScore !== null}
                getTeamFlag={getTeamFlag}
                getTeamFlagUrl={getTeamFlagUrl}
                getGroupLabel={getGroupLabel}
                formatKickoff={formatKickoff}
                onSelect={setSelectedMatch}
              />
            ))}
          </Space>
        </div>
      ))}
    </div>
  );

  const bracketTab = bracketRounds.length ? (
    <div className="wc-bracket-board">
      {bracketRounds.map((round) => (
        <div
          key={round.round}
          className={`wc-bracket-column ${String(round.round).toLowerCase().includes("final") ? "is-final" : ""}`}
        >
          <div className="wc-section-head" style={{ marginBottom: 10 }}>
            <Text strong>{round.round}</Text>
            <Tag style={{ margin: 0 }}>{round.matches.length}</Tag>
          </div>
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            {round.matches.map((match) => (
              <BroadcastMatchCard
                key={`${match.id}-${match.kickoffUtc}`}
                match={match}
                status={STATUS_MAP[String(match.status).toLowerCase()] || STATUS_MAP.scheduled}
                isLive={isLiveMatch(match)}
                hasScore={match.homeScore !== null && match.awayScore !== null}
                getTeamFlag={getTeamFlag}
                getTeamFlagUrl={getTeamFlagUrl}
                getGroupLabel={getGroupLabel}
                formatKickoff={formatKickoff}
                onSelect={setSelectedMatch}
              />
            ))}
          </Space>
        </div>
      ))}
    </div>
  ) : (
    <div className="wc-empty">
      <Empty description="Chưa có dữ liệu nhánh knockout" />
    </div>
  );

  const liveTab = liveMatches.length ? (
    renderHorizontalRail(liveMatches)
  ) : (
    <div className="wc-empty">
      <Empty description="Hiện chưa có trận đang live" />
    </div>
  );

  return (
    <>
      <div className={`wc-dashboard ${isDark ? "is-dark" : ""}`}>
        {matches.length ? (
          <>
            <section
              className="wc-hero"
            >
              <div className="wc-hero-content">
                <div>
                  <span className="wc-kicker">
                    <TrophyOutlined /> World Cup 2026
                  </span>
                  <h1 className="wc-hero-title">Match Center</h1>
                  <Text className="wc-hero-subtitle">
                    Lịch đấu, bảng xếp hạng, knockout và live score theo thời gian thực.
                  </Text>
                  {liveMatches.length > 0 && (
                    <Tag color="red" style={{ marginTop: 12 }}>
                      <span className="wc-live-dot" /> {liveMatches.length} trận đang live
                    </Tag>
                  )}
                </div>
                <div className="wc-stat-grid">
                  <div className="wc-stat-card">
                    <span className="wc-stat-label">Tổng trận</span>
                    <span className="wc-stat-value">{matches.length}</span>
                  </div>
                  <div className="wc-stat-card">
                    <span className="wc-stat-label">Đội tuyển</span>
                    <span className="wc-stat-value">{totalTeams}/48</span>
                  </div>
                  <div className="wc-stat-card">
                    <span className="wc-stat-label">Live</span>
                    <span className="wc-stat-value">{liveMatches.length}</span>
                  </div>
                  <div className="wc-stat-card">
                    <span className="wc-stat-label">Hôm nay</span>
                    <span className="wc-stat-value">{matches.filter(isTodayMatch).length}</span>
                  </div>
                </div>
              </div>
            </section>

            <section
              className="wc-panel"
            >
              <Tabs
                className="wc-tabs"
                items={[
                  { key: "schedule", label: "Lịch đấu", children: scheduleTab },
                  {
                    key: "standings",
                    label: "Bảng xếp hạng",
                    children: standingsTab,
                  },
                  { key: "bracket", label: "Knockout", children: bracketTab },
                  {
                    key: "live",
                    label: `Live (${liveMatches.length})`,
                    children: liveTab,
                  },
                ]}
              />

              <div style={{ textAlign: "center", marginTop: "2px" }}>
                <Text type="secondary" style={{ fontSize: "10px" }}>
                  <CalendarOutlined /> Cập nhật lúc{" "}
                  {formatUpdatedAt(schedule.updatedAt)} từ{" "}
                  {schedule.source || "WC2026 API"}
                  {loading
                    ? " - đang đồng bộ..."
                    : ` - tự làm mới sau ${formatRefreshInterval(
                        schedule.refreshAfterMs
                      )}`}
                </Text>
              </div>
            </section>
          </>
        ) : (
          <div className="wc-panel">
            <Empty description="Chưa có lịch thi đấu World Cup" />
          </div>
        )}
      </div>

      <MatchDetailModal
        match={selectedMatch}
        open={Boolean(selectedMatch)}
        onClose={() => setSelectedMatch(null)}
        status={
          selectedMatch
            ? STATUS_MAP[String(selectedMatch.status).toLowerCase()] ||
              STATUS_MAP.scheduled
            : STATUS_MAP.scheduled
        }
        getTeamFlag={getTeamFlag}
        getTeamFlagUrl={getTeamFlagUrl}
        getGroupLabel={getGroupLabel}
        formatKickoff={formatKickoff}
      />
    </>
  );
};

export default WorldCupScheduleView;
