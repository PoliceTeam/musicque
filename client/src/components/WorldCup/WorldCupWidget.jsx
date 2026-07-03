import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spin } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import { getWorldCupMatches } from '../../services/api';
import { PlaylistContext } from '../../contexts/PlaylistContext';
import { useTheme } from '../../contexts/ThemeContext';
import { isLiveMatch, getTeamFlag, getTeamFlagUrl } from '../../utils/worldCupUtils';

const getTeamAbbr = (name = "") => {
  if (!name || name === "TBD") return "TBD";
  const cleanName = name.replace(/[^a-zA-Z\s]/g, "").trim();
  const words = cleanName.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return cleanName.substring(0, 3).toUpperCase();
};

const WorldCupWidget = () => {
  const { isDark } = useTheme();
  const { socket } = useContext(PlaylistContext);
  const navigate = useNavigate();
  
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);

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
      <div className={`wc-widget ${isDark ? 'is-dark' : ''}`} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 120 }}>
        <Spin size="small" />
      </div>
    );
  }

  const matches = schedule?.matches || [];
  const liveMatches = matches.filter(isLiveMatch);
  
  const today = new Date().toDateString();
  const todayMatches = matches.filter(m => new Date(m.kickoffUtc).toDateString() === today && !isLiveMatch(m) && String(m.status).toLowerCase() === 'scheduled');
  
  const upcomingMatches = matches
    .filter(m => !isLiveMatch(m) && String(m.status).toLowerCase() === 'scheduled' && new Date(m.kickoffUtc).toDateString() !== today)
    .sort((a, b) => new Date(a.kickoffUtc) - new Date(b.kickoffUtc));

  // Decide what to show (Max 3 matches)
  let displayMatches = [];
  let headerText = "World Cup 2026";
  let isLive = false;

  if (liveMatches.length > 0) {
    displayMatches = liveMatches.slice(0, 3);
    headerText = "Đang diễn ra";
    isLive = true;
  } else if (todayMatches.length > 0) {
    displayMatches = todayMatches.slice(0, 3);
    headerText = "Hôm nay";
  } else if (upcomingMatches.length > 0) {
    displayMatches = upcomingMatches.slice(0, 3);
    headerText = "Sắp tới";
  } else {
    // Check finished matches
    const finishedMatches = matches
      .filter(m => String(m.status).toLowerCase() === 'finished' || String(m.status).toLowerCase() === 'completed')
      .sort((a, b) => new Date(b.kickoffUtc) - new Date(a.kickoffUtc))
      .slice(0, 3);
    if (finishedMatches.length > 0) {
      displayMatches = finishedMatches;
      headerText = "Kết quả mới nhất";
    }
  }

  return (
    <div 
      className={`wc-widget ${isDark ? 'is-dark' : 'is-light'}`}
      onClick={() => navigate('/world-cup')}
    >
      <div className="wc-widget__header">
        <div className="wc-widget__title">
          <TrophyOutlined style={{ color: 'var(--wc-accent)' }} />
          <span>{headerText}</span>
        </div>
        {isLive && (
          <div className="wc-widget__live-badge">
            <span className="pulse-dot"></span>
            LIVE
          </div>
        )}
      </div>
      
      <div className="wc-widget__list">
        {displayMatches.length > 0 ? (
          displayMatches.map(match => {
            const dateObj = new Date(match.kickoffUtc);
            const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            const isMatchLive = isLiveMatch(match);
            const hasScore = match.homeScore !== null && match.awayScore !== null;
            
            return (
              <div key={match.id} className="wc-widget-match">
                <div className="wc-widget-match__team">
                  {getTeamFlagUrl(match.homeTeam) ? (
                    <img src={getTeamFlagUrl(match.homeTeam)} alt="" className="team-flag-img" />
                  ) : (
                    <span className="team-flag">{getTeamFlag(match.homeTeam)}</span>
                  )}
                  <span className="team-name">{getTeamAbbr(match.homeTeam)}</span>
                </div>
                <div className="wc-widget-match__center">
                  <div className={`match-score ${isMatchLive ? 'is-live' : ''}`}>
                    {(isMatchLive || hasScore) ? `${match.homeScore} - ${match.awayScore}` : 'VS'}
                  </div>
                  <div className="match-time">
                    {isMatchLive ? (match.elapsed || 'H1') : timeStr}
                  </div>
                </div>
                <div className="wc-widget-match__team is-away">
                  <span className="team-name">{getTeamAbbr(match.awayTeam)}</span>
                  {getTeamFlagUrl(match.awayTeam) ? (
                    <img src={getTeamFlagUrl(match.awayTeam)} alt="" className="team-flag-img" />
                  ) : (
                    <span className="team-flag">{getTeamFlag(match.awayTeam)}</span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="wc-widget-empty">Chưa có dữ liệu</div>
        )}
      </div>
    </div>
  );
};

export default WorldCupWidget;
