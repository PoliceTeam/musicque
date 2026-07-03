import React, { useState, useEffect, useContext } from 'react';
import { Popover, Drawer, Typography, Spin } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getWorldCupMatches } from '../../services/api';
import { PlaylistContext } from '../../contexts/PlaylistContext';
import { useTheme } from '../../contexts/ThemeContext';
import { isLiveMatch } from '../../utils/worldCupUtils';
import WorldCupSchedulePanel from './WorldCupSchedulePanel';

const { Text } = Typography;

const WorldCupHeaderChip = () => {
  const { isDark } = useTheme();
  const { socket } = useContext(PlaylistContext);
  const navigate = useNavigate();
  
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const matches = schedule?.matches || [];
  const liveMatches = matches.filter(isLiveMatch);
  
  const today = new Date().toDateString();
  const todayMatches = matches.filter(m => new Date(m.kickoffUtc).toDateString() === today);
  
  const upcomingMatches = matches
    .filter(m => !isLiveMatch(m) && String(m.status).toLowerCase() === 'scheduled')
    .sort((a, b) => new Date(a.kickoffUtc) - new Date(b.kickoffUtc));

const getTeamAbbr = (name = "") => {
  if (!name || name === "TBD") return "TBD";
  const cleanName = name.replace(/[^a-zA-Z\s]/g, "").trim();
  const words = cleanName.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return cleanName.substring(0, 3).toUpperCase();
};

  // Determine Chip Content
  let chipContent = null;
  let isLive = false;

  if (loading && !schedule) {
    chipContent = <Spin size="small" />;
  } else if (liveMatches.length > 0) {
    isLive = true;
    const m = liveMatches[0];
    const h = getTeamAbbr(m.homeTeam);
    const a = getTeamAbbr(m.awayTeam);
    chipContent = isMobile 
      ? `LIVE ${liveMatches.length}` 
      : `LIVE ${liveMatches.length} · ${h} ${m.homeScore}-${m.awayScore} ${a}`;
  } else if (todayMatches.length > 0) {
    const nextMatch = todayMatches.find(m => String(m.status).toLowerCase() === 'scheduled') || todayMatches[0];
    const h = getTeamAbbr(nextMatch.homeTeam);
    const a = getTeamAbbr(nextMatch.awayTeam);
    const time = new Date(nextMatch.kickoffUtc).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    chipContent = isMobile 
      ? `Hôm nay: ${todayMatches.length}` 
      : `Hôm nay ${todayMatches.length} trận · Tiếp theo: ${h} vs ${a} (${time})`;
  } else if (upcomingMatches.length > 0) {
    const nextMatch = upcomingMatches[0];
    const h = getTeamAbbr(nextMatch.homeTeam);
    const a = getTeamAbbr(nextMatch.awayTeam);
    const date = new Date(nextMatch.kickoffUtc).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    chipContent = isMobile 
      ? `Kế tiếp: ${date}` 
      : `Tiếp theo: ${h} vs ${a} (${date})`;
  } else {
    chipContent = 'World Cup 2026';
  }

  const trigger = (
    <div 
      className={`wc-header-chip ${isDark ? 'is-dark' : ''} ${isLive ? 'is-live' : ''}`}
      onClick={() => setOpen(true)}
    >
      <TrophyOutlined className="wc-header-chip__icon" />
      {isLive && <div className="live-indicator" style={{ width: 6, height: 6, flexShrink: 0 }} />}
      <Text className="wc-header-chip__text" strong style={{ color: isLive ? '#52c41a' : undefined }}>
        {chipContent}
      </Text>
    </div>
  );

  const handleViewFull = () => {
    setOpen(false);
    navigate('/world-cup');
  };

  const panelContent = <WorldCupSchedulePanel matches={matches} onViewFull={handleViewFull} />;

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer
          title={null}
          placement="bottom"
          closable={false}
          onClose={() => setOpen(false)}
          open={open}
          height="80vh"
          styles={{ body: { padding: '16px', background: isDark ? '#141414' : '#fff' } }}
        >
          {panelContent}
        </Drawer>
      </>
    );
  }

  return (
    <Popover
      content={<div style={{ width: 420 }}>{panelContent}</div>}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomLeft"
      overlayInnerStyle={{ 
        padding: 16, 
        borderRadius: 16, 
        background: isDark ? '#1f1f1f' : '#fff',
        border: `1px solid ${isDark ? '#303030' : 'rgba(0,0,0,0.08)'}`,
        boxShadow: isDark ? '0 12px 48px rgba(0,0,0,0.6)' : '0 12px 48px rgba(0,0,0,0.12)'
      }}
    >
      {trigger}
    </Popover>
  );
};

export default WorldCupHeaderChip;
