import React from "react";
import { Tag, Typography } from "antd";
import { ClockCircleOutlined, EnvironmentOutlined } from "@ant-design/icons";

const { Text } = Typography;

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

  return (
    <button
      type="button"
      className={`wc-match-card ${isLive ? "is-live" : ""} ${compact ? "is-compact" : ""} ${noHover ? "no-hover" : ""}`}
      onClick={() => onSelect(match)}
      style={noHover ? { cursor: 'pointer' } : undefined}
    >
      <div className="wc-match-meta">
        <span className="wc-group-pill">{getGroupLabel(match)}</span>
        <Tag color={status.color} className="wc-status" style={{ margin: 0 }}>
          {isLive && <span className="wc-live-dot" />}
          {status.label}
        </Tag>
      </div>

      <div className="wc-match-teams">
        <div className="wc-team">
          <span className="wc-flag">
            {homeFlagUrl ? (
              <img src={homeFlagUrl} alt={`${match.homeTeam} flag`} />
            ) : getTeamFlag(match.homeTeam) ? (
              getTeamFlag(match.homeTeam)
            ) : (
              <span className="wc-flag-txt">{getTeamAbbreviation(match.homeTeam)}</span>
            )}
          </span>
          <span className="wc-team-name" title={match.homeTeam}>
            {match.homeTeam || "TBD"}
          </span>
        </div>
        <div className="wc-score-box">
          {hasScore ? `${match.homeScore}-${match.awayScore}` : "VS"}
        </div>
        <div className="wc-team is-right">
          <span className="wc-flag">
            {awayFlagUrl ? (
              <img src={awayFlagUrl} alt={`${match.awayTeam} flag`} />
            ) : getTeamFlag(match.awayTeam) ? (
              getTeamFlag(match.awayTeam)
            ) : (
              <span className="wc-flag-txt">{getTeamAbbreviation(match.awayTeam)}</span>
            )}
          </span>
          <span className="wc-team-name" title={match.awayTeam}>
            {match.awayTeam || "TBD"}
          </span>
        </div>
      </div>

      <div className="wc-match-footer">
        <span className="wc-time-line">
          <ClockCircleOutlined /> {formatKickoff(match.kickoffUtc)}
        </span>
        {(match.stadium || match.city) && (
          <span className="wc-muted-line" title={[match.stadium, match.city].filter(Boolean).join(", ")}>
            <EnvironmentOutlined /> {[match.stadium, match.city].filter(Boolean).join(", ")}
          </span>
        )}
      </div>
    </button>
  );
};

export default MatchCard;
