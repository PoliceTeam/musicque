import React from "react";
import { Tag } from "antd";
import { ClockCircleOutlined, EnvironmentOutlined } from "@ant-design/icons";

const getTeamAbbreviation = (name = "") => {
  if (!name || name === "TBD") return "TBD";
  const cleanName = name.replace(/[^a-zA-Z\s]/g, "").trim();
  const words = cleanName.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return cleanName.substring(0, 3).toUpperCase();
};

const MatchCard = ({
  match,
  status,
  isLive,
  hasScore,
  getTeamFlag,
  getTeamFlagUrl,
  getGroupLabel,
  formatKickoff,
  onSelect,
  compact = false,
  noHover = false,
}) => {
  const homeFlagUrl = getTeamFlagUrl?.(match.homeTeam);
  const awayFlagUrl = getTeamFlagUrl?.(match.awayTeam);
  const isFinished = match.status === "finished";

  const renderFlag = (teamName, flagUrl) => {
    if (flagUrl) {
      return <img src={flagUrl} alt={`${teamName} flag`} />;
    }
    const emoji = getTeamFlag(teamName);
    if (emoji) return emoji;
    return <span className="wc-flag-txt">{getTeamAbbreviation(teamName)}</span>;
  };

  return (
    <button
      type="button"
      className={`wc-match-card ${isLive ? "is-live" : ""} ${isFinished ? "is-finished" : ""} ${compact ? "is-compact" : ""} ${noHover ? "no-hover" : ""}`}
      onClick={() => onSelect(match)}
      style={noHover ? { cursor: "pointer" } : undefined}
    >
      {/* Top accent bar */}
      <div className="wc-card-accent" />

      {/* Header: Group + Status */}
      <div className="wc-match-meta">
        <span className="wc-group-pill">{getGroupLabel(match)}</span>
        <Tag color={status.color} className="wc-status" style={{ margin: 0 }}>
          {isLive && <span className="wc-live-dot" />}
          {status.label}
          {isLive && match.elapsed && (
            <span className="wc-elapsed">{match.elapsed}'</span>
          )}
        </Tag>
      </div>

      {/* Teams & Score */}
      <div className="wc-match-teams">
        <div className="wc-team">
          <span className="wc-flag">{renderFlag(match.homeTeam, homeFlagUrl)}</span>
          <span className="wc-team-name" title={match.homeTeam}>
            {match.homeTeam || "TBD"}
          </span>
        </div>

        <div className="wc-score-center">
          {hasScore ? (
            <div className="wc-score-split">
              <span className="wc-score-num">{match.homeScore}</span>
              <span className="wc-score-sep">:</span>
              <span className="wc-score-num">{match.awayScore}</span>
            </div>
          ) : (
            <span className="wc-vs-label">VS</span>
          )}
        </div>

        <div className="wc-team is-right">
          <span className="wc-flag">{renderFlag(match.awayTeam, awayFlagUrl)}</span>
          <span className="wc-team-name" title={match.awayTeam}>
            {match.awayTeam || "TBD"}
          </span>
        </div>
      </div>

      {/* Footer: Time + Venue */}
      <div className="wc-match-footer">
        <span className="wc-time-line">
          <ClockCircleOutlined />
          <span>{match.kickoffVietnam || formatKickoff(match.kickoffUtc)}</span>
        </span>
        {(match.stadium || match.city) && (
          <span
            className="wc-venue-line"
            title={[match.stadium, match.city].filter(Boolean).join(", ")}
          >
            <EnvironmentOutlined />
            <span>{[match.stadium, match.city].filter(Boolean).join(", ")}</span>
          </span>
        )}
      </div>
    </button>
  );
};

export default MatchCard;
