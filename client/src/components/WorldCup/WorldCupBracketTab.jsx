import React, { useState } from "react";
import { Empty, Typography, Tag, Space } from "antd";
import MatchCard from "./MatchCard";

const { Text } = Typography;

const WorldCupBracketTab = ({
  bracket,
  STATUS_MAP,
  isLiveMatch,
  getTeamFlag,
  getTeamFlagUrl,
  getGroupLabel,
  formatKickoff,
  onSelectMatch,
}) => {
  const [activeMobileRound, setActiveMobileRound] = useState(null);

  if (!bracket || !Array.isArray(bracket) || bracket.length === 0) {
    return (
      <div className="wc-empty-state">
        <Empty description="Chưa có dữ liệu nhánh knockout" />
      </div>
    );
  }

  // Bracket usually ordered from Ro32 -> Final
  const rounds = bracket;

  // Initialize mobile round if not set
  if (!activeMobileRound && rounds.length > 0) {
    setActiveMobileRound(rounds[0].round);
  }

  // --- Mobile View Component ---
  const renderMobileView = () => {
    const currentRound = rounds.find(r => r.round === activeMobileRound) || rounds[0];
    return (
      <div className="wc-bracket-mobile" style={{ display: 'none' }}>
        {/* We use CSS media queries to show/hide this vs desktop board. For simplicity, we just use conditional rendering based on window width or CSS hiding. 
            Since we need true responsiveness, we can render both and hide via CSS or use a matchMedia hook. 
            Let's rely on CSS media queries. */}
      </div>
    );
  };

  return (
    <>
      <style>{`
        .wc-bracket-desktop { display: flex; }
        .wc-bracket-mobile { display: none; }
        @media (max-width: 992px) {
          .wc-bracket-desktop { display: none; }
          .wc-bracket-mobile { display: block; }
        }
      `}</style>

      {/* Desktop Horizontal Board */}
      <div className="wc-bracket-desktop wc-bracket-board">
        {rounds.map((round) => (
          <div key={round.round} className="wc-bracket-round">
            <div className="wc-bracket-round-title">
              {String(round.round).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
            </div>
            
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              {round.matches?.map((match) => (
                <div key={`${match.id}-${match.kickoffUtc}`} className="wc-bracket-match">
                  <MatchCard
                    match={match}
                    status={STATUS_MAP[String(match.status).toLowerCase()] || STATUS_MAP.scheduled}
                    isLive={isLiveMatch(match)}
                    hasScore={match.homeScore !== null && match.awayScore !== null}
                    getTeamFlag={getTeamFlag}
                    getTeamFlagUrl={getTeamFlagUrl}
                    getGroupLabel={getGroupLabel}
                    formatKickoff={formatKickoff}
                    onSelect={onSelectMatch}
                    variant="compact"
                  />
                </div>
              ))}
            </Space>
          </div>
        ))}
      </div>

      {/* Mobile Segmented View */}
      <div className="wc-bracket-mobile">
        <div className="wc-schedule-toolbar">
          <div className="wc-schedule-filters">
            {rounds.map(r => (
              <button
                key={r.round}
                type="button"
                className={`wc-pill ${activeMobileRound === r.round ? "is-active" : ""}`}
                onClick={() => setActiveMobileRound(r.round)}
              >
                {String(r.round).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
              </button>
            ))}
          </div>
        </div>

        <div className="wc-day-group__list">
          {rounds.find(r => r.round === activeMobileRound)?.matches?.map((match) => (
            <MatchCard
              key={`${match.id}-${match.kickoffUtc}`}
              match={match}
              status={STATUS_MAP[String(match.status).toLowerCase()] || STATUS_MAP.scheduled}
              isLive={isLiveMatch(match)}
              hasScore={match.homeScore !== null && match.awayScore !== null}
              getTeamFlag={getTeamFlag}
              getTeamFlagUrl={getTeamFlagUrl}
              getGroupLabel={getGroupLabel}
              formatKickoff={formatKickoff}
              onSelect={onSelectMatch}
              variant="default"
            />
          ))}
        </div>
      </div>
    </>
  );
};

export default WorldCupBracketTab;
