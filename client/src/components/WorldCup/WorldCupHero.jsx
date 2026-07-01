import React from "react";
import { TrophyOutlined, SyncOutlined, CheckCircleOutlined, WarningOutlined } from "@ant-design/icons";
import { Typography } from "antd";
import { formatUpdatedAt } from "../../utils/worldCupUtils";

const { Text } = Typography;

const WorldCupHero = ({
  matches,
  liveMatches,
  todayMatches,
  socketConnected,
  lastUpdatedAt,
}) => {
  return (
    <div className="wc-hero">
      <div className="wc-hero__content">
        <div>
          <span style={{ color: 'var(--wc-accent)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 13 }}>
            <TrophyOutlined style={{ marginRight: 6 }} /> FIFA World Cup 2026™
          </span>
          <h1 className="wc-hero__title">Match Center</h1>
          <div style={{ fontSize: 16, color: 'var(--wc-text-secondary)' }}>
            Bảng điều khiển trực tiếp lịch đấu, tỷ số và nhánh đấu.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 16 }}>
          {/* Realtime Badge */}
          <div className={`wc-realtime-badge ${socketConnected ? 'is-online' : 'is-offline'}`}>
            {socketConnected ? (
              <><span className="wc-pulse-dot" style={{ margin: 0, width: 8, height: 8, animation: 'none' }} /> Live Sync: On</>
            ) : (
              <><WarningOutlined /> Reconnecting...</>
            )}
          </div>

          {/* Stats */}
          <div className="wc-hero__stats">
            <div className={`wc-stat-card ${liveMatches.length > 0 ? 'is-live' : ''}`}>
              <span className="wc-stat-label">
                {liveMatches.length > 0 && <span className="wc-pulse-dot" />}
                Đang Live
              </span>
              <span className="wc-stat-value">{liveMatches.length}</span>
            </div>
            
            <div className="wc-stat-card">
              <span className="wc-stat-label">Trận hôm nay</span>
              <span className="wc-stat-value">{todayMatches.length}</span>
            </div>

            <div className="wc-stat-card">
              <span className="wc-stat-label">Tổng trận</span>
              <span className="wc-stat-value">{matches.length}/104</span>
            </div>
          </div>
          
          <div style={{ fontSize: 13, color: 'var(--wc-text-secondary)', fontWeight: 500 }}>
            Cập nhật lần cuối: {formatUpdatedAt(lastUpdatedAt)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorldCupHero;
