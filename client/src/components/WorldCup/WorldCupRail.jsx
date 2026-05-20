import React, { useContext, useEffect, useState, useRef } from "react";
import { Spin, Typography } from "antd";
import { TrophyOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { getWorldCupMatches } from "../../services/api";
import { PlaylistContext } from "../../contexts/PlaylistContext";
import { useTheme } from "../../contexts/ThemeContext";
import MatchCard from "./MatchCard";
import {
  STATUS_MAP,
  isLiveMatch,
  getTeamFlag,
  getTeamFlagUrl,
  getGroupLabel,
  formatKickoff,
} from "./WorldCupScheduleView";
import "./WorldCup.css";

const WorldCupRail = () => {
  const { isDark } = useTheme();
  const { socket } = useContext(PlaylistContext);
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const railRef = useRef(null);

  const fetchData = async () => {
    try {
      const res = await getWorldCupMatches(104);
      setSchedule(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleScheduleUpdate = (nextSchedule) => {
      setSchedule(nextSchedule);
    };
    socket.on("world_cup_schedule_updated", handleScheduleUpdate);
    return () => socket.off("world_cup_schedule_updated", handleScheduleUpdate);
  }, [socket]);

  if (loading && !schedule) {
    return (
      <div style={{ height: "100px", display: "flex", justifyContent: "center", alignItems: "center", borderBottom: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`, background: isDark ? '#141414' : '#fff' }}>
        <Spin />
      </div>
    );
  }

  const matches = schedule?.matches || [];
  const live = matches.filter(isLiveMatch);
  const upcoming = matches
    .filter((m) => !isLiveMatch(m) && String(m.status).toLowerCase() === "scheduled")
    .sort((a, b) => new Date(a.kickoffUtc) - new Date(b.kickoffUtc));
  
  const featuredMatches = [...live, ...upcoming].slice(0, 10);

  if (featuredMatches.length === 0) return null;

  return (
    <div style={{ 
      padding: '24px 24px 8px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <TrophyOutlined style={{ color: '#faad14', fontSize: '18px' }} />
        <Typography.Text strong style={{ fontSize: '16px' }}>Lịch đấu nổi bật</Typography.Text>
      </div>
      <div 
        ref={railRef} 
        className={`wc-rail ${isDark ? "is-dark" : ""}`} 
        style={{ 
          margin: 0, 
          paddingBottom: '4px', 
          paddingTop: '2px', 
          flex: 1, 
          overflowX: 'auto', 
          WebkitOverflowScrolling: 'touch', 
          display: 'flex', 
          alignItems: 'stretch',
          gap: '12px'
        }}
      >
        {featuredMatches.map((match) => (
          <div
            key={`${match.id}-${match.kickoffUtc}`}
            className="wc-rail-item"
            style={{ width: '250px', flex: '0 0 250px', display: 'flex' }}
          >
            <MatchCard
              match={match}
              status={STATUS_MAP[String(match.status).toLowerCase()] || STATUS_MAP.scheduled}
              isLive={isLiveMatch(match)}
              hasScore={match.homeScore !== null && match.awayScore !== null}
              getTeamFlag={getTeamFlag}
              getTeamFlagUrl={getTeamFlagUrl}
              getGroupLabel={getGroupLabel}
              formatKickoff={formatKickoff}
              onSelect={() => navigate('/world-cup')}
              compact={true}
              noHover={true}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorldCupRail;