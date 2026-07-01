import React, { useState, useMemo, useEffect } from "react";
import { Input, Typography, Empty, Select } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import MatchCard from "./MatchCard";
import { isLiveMatch, isTodayMatch, normalizeTeamName } from "../../utils/worldCupUtils";

const { Text } = Typography;

const WorldCupScheduleTab = ({
  matches,
  STATUS_MAP,
  getTeamFlag,
  getTeamFlagUrl,
  getGroupLabel,
  formatKickoff,
  onSelectMatch,
  groupMatchesByDate,
}) => {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Determine initial filter based on live matches
  useEffect(() => {
    if (matches.some(isLiveMatch)) {
      setFilter("live");
    } else if (matches.some(isTodayMatch)) {
      setFilter("today");
    }
  }, [matches]);

  const filteredMatches = useMemo(() => {
    let result = matches;

    // Apply Filter
    if (filter === "live") {
      result = result.filter(isLiveMatch);
    } else if (filter === "today") {
      result = result.filter(isTodayMatch);
    } else if (filter === "upcoming") {
      result = result.filter(m => m.status === "scheduled");
    } else if (filter === "finished") {
      result = result.filter(m => m.status === "finished" || m.status === "completed");
    } else if (filter === "group") {
      result = result.filter(m => String(m.round || "").toLowerCase().includes("group") || m.groupName);
    } else if (filter === "knockout") {
      result = result.filter(m => !String(m.round || "").toLowerCase().includes("group") && !m.groupName);
    }

    // Apply Search
    if (search.trim()) {
      const q = normalizeTeamName(search.toLowerCase());
      result = result.filter(m => 
        normalizeTeamName(m.homeTeam?.toLowerCase() || "").includes(q) ||
        normalizeTeamName(m.awayTeam?.toLowerCase() || "").includes(q)
      );
    }

    return result;
  }, [matches, filter, search]);

  const grouped = groupMatchesByDate(filteredMatches);
  const sortedDates = Object.keys(grouped).sort((a, b) => {
    const dateA = new Date(grouped[a][0].kickoffUtc);
    const dateB = new Date(grouped[b][0].kickoffUtc);
    return dateA - dateB;
  });

  return (
    <div>
      <div className="wc-schedule-toolbar">
        <div className="wc-schedule-filters">
          {[
            { key: "all", label: "Tất cả" },
            { key: "live", label: "Đang Live" },
            { key: "today", label: "Hôm nay" },
            { key: "upcoming", label: "Sắp tới" },
            { key: "finished", label: "Đã xong" },
            { key: "group", label: "Vòng bảng" },
            { key: "knockout", label: "Knockout" },
          ].map(f => (
            <button
              key={f.key}
              type="button"
              className={`wc-pill ${filter === f.key ? "is-active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        
        <div className="wc-schedule-search">
          <Input 
            placeholder="Tìm đội tuyển..." 
            prefix={<SearchOutlined style={{ color: 'rgba(0,0,0,0.25)' }}/>}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ borderRadius: 999 }}
            allowClear
          />
        </div>
      </div>

      {sortedDates.length === 0 ? (
        <div className="wc-empty-state">
          <Empty description={`Không tìm thấy trận đấu nào cho bộ lọc hiện tại`} />
        </div>
      ) : (
        sortedDates.map((dateKey) => (
          <div key={dateKey} className="wc-day-group">
            <div className="wc-day-group__header">
              <h3>{dateKey}</h3>
              <div className="wc-day-group__line" />
            </div>
            <div className="wc-day-group__list">
              {grouped[dateKey].map((match) => {
                const isLive = isLiveMatch(match);
                const statusInfo = STATUS_MAP[String(match.status).toLowerCase()] || STATUS_MAP.scheduled;
                return (
                  <MatchCard
                    key={match.id}
                    match={match}
                    status={statusInfo}
                    isLive={isLive}
                    hasScore={match.homeScore !== null && match.awayScore !== null}
                    getTeamFlag={getTeamFlag}
                    getTeamFlagUrl={getTeamFlagUrl}
                    getGroupLabel={getGroupLabel}
                    formatKickoff={formatKickoff}
                    onSelect={onSelectMatch}
                    variant="compact"
                  />
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default WorldCupScheduleTab;
