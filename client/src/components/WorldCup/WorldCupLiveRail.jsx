import React from "react";
import MatchCard from "./MatchCard";

const WorldCupLiveRail = ({
  liveMatches,
  getTeamFlag,
  getTeamFlagUrl,
  getGroupLabel,
  formatKickoff,
  STATUS_MAP,
  onSelectMatch,
}) => {
  if (!liveMatches || liveMatches.length === 0) return null;

  return (
    <div className="wc-live-rail">
      <div className="wc-live-rail__header">
        <span className="wc-pulse-dot" style={{ margin: 0, width: 8, height: 8 }} />
        Matches Live Now
      </div>
      <div className="wc-live-rail__scroll">
        {liveMatches.map((match) => (
          <div key={match.id} style={{ minWidth: liveMatches.length === 1 ? '100%' : 320, flexShrink: 0 }}>
            <MatchCard
              match={match}
              status={STATUS_MAP[String(match.status).toLowerCase()] || STATUS_MAP.live}
              isLive={true}
              hasScore={match.homeScore !== null && match.awayScore !== null}
              getTeamFlag={getTeamFlag}
              getTeamFlagUrl={getTeamFlagUrl}
              getGroupLabel={getGroupLabel}
              formatKickoff={formatKickoff}
              onSelect={onSelectMatch}
              variant={liveMatches.length === 1 ? "featured" : "default"}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorldCupLiveRail;
