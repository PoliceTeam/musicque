import React from 'react';
import { Tabs, Typography, Button, Empty, Space } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import {
  isLiveMatch,
  getTeamFlag,
  formatKickoff,
} from '../../utils/worldCupUtils';
import { useTheme } from '../../contexts/ThemeContext';

const { Text } = Typography;

const getTeamAbbr = (name = "") => {
  if (!name || name === "TBD") return "TBD";
  const cleanName = name.replace(/[^a-zA-Z\s]/g, "").trim();
  const words = cleanName.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return cleanName.substring(0, 3).toUpperCase();
};

const CompactMatchRow = ({ match }) => {
  const { isDark } = useTheme();
  const isLive = isLiveMatch(match);
  const homeCode = getTeamAbbr(match.homeTeam);
  const awayCode = getTeamAbbr(match.awayTeam);
  const hasScore = match.homeScore !== null && match.awayScore !== null;
  
  const dateObj = new Date(match.kickoffUtc);
  const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  
  return (
    <div className={`wc-match-row ${isLive ? 'wc-match-row--live' : ''} ${isDark ? 'is-dark' : ''}`}>
      <div className="wc-match-row__time" style={{ textAlign: 'center', minWidth: 40, lineHeight: 1.2 }}>
        <div style={{ fontWeight: 700, color: isDark ? '#fff' : '#1f1f1f' }}>{timeStr}</div>
        <div style={{ fontSize: 10, color: 'var(--ant-color-text-secondary)', marginTop: 2 }}>{dateStr}</div>
      </div>
      
      <div className="wc-match-row__teams">
        <Space size={6} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Text strong>{homeCode}</Text>
          <span style={{ fontSize: 16 }}>{getTeamFlag(match.homeTeam)}</span>
        </Space>
        
        <div className="wc-match-row__score">
          {isLive ? (
            <span className="live-score">{match.homeScore}-{match.awayScore}</span>
          ) : hasScore ? (
            <span className="final-score">{match.homeScore}-{match.awayScore}</span>
          ) : (
            <span className="vs-text">vs</span>
          )}
        </div>

        <Space size={6} style={{ flex: 1 }}>
          <span style={{ fontSize: 16 }}>{getTeamFlag(match.awayTeam)}</span>
          <Text strong>{awayCode}</Text>
        </Space>
      </div>
      
      {isLive && <div className="wc-match-row__status"><div className="live-indicator" style={{ width: 6, height: 6 }}/> LIVE</div>}
    </div>
  );
};

const WorldCupSchedulePanel = ({ matches, onViewFull }) => {
  const today = new Date().toDateString();
  const todayMatches = matches.filter(m => new Date(m.kickoffUtc).toDateString() === today);
  
  const upcomingMatches = matches
    .filter(m => !isLiveMatch(m) && String(m.status).toLowerCase() === 'scheduled' && new Date(m.kickoffUtc).toDateString() !== today)
    .sort((a, b) => new Date(a.kickoffUtc) - new Date(b.kickoffUtc))
    .slice(0, 8);
    
  const finishedMatches = matches
    .filter(m => String(m.status).toLowerCase() === 'finished' || String(m.status).toLowerCase() === 'completed')
    .sort((a, b) => new Date(b.kickoffUtc) - new Date(a.kickoffUtc))
    .slice(0, 5);
    
  return (
    <div className="wc-schedule-panel">
      <div className="wc-schedule-panel__header">
        <TrophyOutlined style={{ color: '#faad14', fontSize: 18 }} />
        <Text strong>Lịch đấu World Cup 2026</Text>
      </div>
      
      <Tabs
        className="segmented-tabs"
        defaultActiveKey="today"
        items={[
          {
            label: 'Hôm nay',
            key: 'today',
            children: todayMatches.length > 0 ? (
              <div className="wc-match-list">
                {todayMatches.map(m => <CompactMatchRow key={m.id} match={m} />)}
              </div>
            ) : <Empty description="Không có trận hôm nay" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          },
          {
            label: 'Sắp tới',
            key: 'upcoming',
            children: upcomingMatches.length > 0 ? (
               <div className="wc-match-list">
                {upcomingMatches.map(m => <CompactMatchRow key={m.id} match={m} />)}
              </div>
            ) : <Empty description="Không có lịch sắp tới" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          },
          {
            label: 'Kết quả',
            key: 'results',
            children: finishedMatches.length > 0 ? (
               <div className="wc-match-list">
                {finishedMatches.map(m => <CompactMatchRow key={m.id} match={m} />)}
              </div>
            ) : <Empty description="Chưa có kết quả" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          }
        ]}
      />
      <Button block type="dashed" onClick={onViewFull} style={{ marginTop: 16 }}>
        Xem đầy đủ lịch đấu
      </Button>
    </div>
  );
};

export default WorldCupSchedulePanel;
