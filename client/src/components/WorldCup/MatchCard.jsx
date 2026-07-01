import React from "react";
import { ClockCircleOutlined, EnvironmentOutlined } from "@ant-design/icons";
import { getTeamAbbreviation } from "../../utils/worldCupUtils";

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
  variant = "default", // 'compact' | 'default' | 'featured'
}) => {
  const homeFlagUrl = getTeamFlagUrl?.(match.homeTeam);
  const awayFlagUrl = getTeamFlagUrl?.(match.awayTeam);
  const isFinished = match.status === "finished" || match.status === "completed";

  const renderFlag = (teamName, flagUrl) => {
    if (flagUrl) {
      return <img className="wc-team__flag" src={flagUrl} alt={`${teamName} flag`} />;
    }
    const emoji = getTeamFlag(teamName);
    if (emoji) return <span className="wc-team__flag wc-team__flag--emoji">{emoji}</span>;
    return <span className="wc-team__flag wc-team__flag--text" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700}}>{getTeamAbbreviation(teamName)}</span>;
  };

  const getVariantClass = () => {
    switch (variant) {
      case "compact": return "wc-match-card--compact";
      case "featured": return "wc-match-card--featured";
      default: return "";
    }
  };

  return (
    <button
      type="button"
      className={`wc-match-card ${getVariantClass()} ${isLive ? "wc-match-card--live" : ""} ${isFinished ? "wc-match-card--finished" : ""}`}
      onClick={() => onSelect && onSelect(match)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 12, fontWeight: 600 }}>
        <span style={{ color: 'var(--wc-text-secondary)' }}>{getGroupLabel(match)}</span>
        
        <span className={`wc-status-badge ${isLive ? "wc-status-badge--live" : ""}`}>
          {isLive && <span className="wc-pulse-dot" />}
          {status?.label || match.status}
          {isLive && match.elapsed && (
            <span style={{ marginLeft: 4 }}>{match.elapsed}'</span>
          )}
        </span>
      </div>

      <div className="wc-match-card__content">
        <div className="wc-team">
          {renderFlag(match.homeTeam, homeFlagUrl)}
          <span className="wc-team__name" title={match.homeTeam}>
            {match.homeTeam || "TBD"}
          </span>
        </div>

        <div className="wc-score-center" style={{ textAlign: 'center' }}>
          {hasScore ? (
            <div className={`wc-score ${isLive ? "wc-score--live" : ""}`}>
              {match.homeScore} - {match.awayScore}
            </div>
          ) : (
            <div className="wc-score" style={{ fontSize: 20, color: 'var(--wc-border-hover)' }}>VS</div>
          )}
        </div>

        <div className="wc-team">
          {renderFlag(match.awayTeam, awayFlagUrl)}
          <span className="wc-team__name" title={match.awayTeam}>
            {match.awayTeam || "TBD"}
          </span>
        </div>
      </div>

      {variant !== "compact" && (
        <div className="wc-match-card__meta">
          <span style={{ marginRight: 16 }}>
            <ClockCircleOutlined /> {match.kickoffVietnam || formatKickoff(match.kickoffUtc)}
          </span>
          {(match.stadium || match.city) && (
            <span title={[match.stadium, match.city].filter(Boolean).join(", ")}>
              <EnvironmentOutlined /> {[match.stadium, match.city].filter(Boolean).join(", ")}
            </span>
          )}
        </div>
      )}
    </button>
  );
};

export default MatchCard;
