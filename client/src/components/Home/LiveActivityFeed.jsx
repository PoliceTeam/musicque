import React, { useContext } from 'react';
import { ClearOutlined } from '@ant-design/icons';
import { PlaylistContext } from '../../contexts/PlaylistContext';
import useActivityFeed from '../../hooks/useActivityFeed';
import { formatActivityTime } from '../../utils/activityFeed';

const toneColorMap = {
  success: 'var(--sp-green)',
  warning: '#f59b23',
  processing: '#0d73ec',
  default: 'var(--sp-text)',
};

const LiveActivityFeed = ({ className = '' }) => {
  const { socket, currentSession } = useContext(PlaylistContext);
  const { items, clearItems } = useActivityFeed(socket);

  const emptyMessage = !currentSession
    ? 'Chờ phiên phát nhạc để xem hoạt động'
    : 'Chưa có hoạt động nào';

  return (
    <section
      className={`sp-panel sp-panel--grow ${className}`.trim()}
      data-testid="live-activity-feed"
    >
      <div className="sp-panel__head">
        <h2 className="sp-panel__title">
          <span aria-hidden="true">⚡</span>
          Hoạt động trực tiếp
        </h2>
        {items.length > 0 && (
          <button
            type="button"
            className="sp-btn sp-btn--ghost sp-btn--icon"
            onClick={clearItems}
            aria-label="Clear activity feed"
          >
            <ClearOutlined />
          </button>
        )}
      </div>

      <div className="sp-panel__body">
        {!currentSession || items.length === 0 ? (
          <div className="sp-empty">
            <span className="sp-empty__icon" aria-hidden="true">
              📡
            </span>
            <span>{emptyMessage}</span>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((item) => (
              <li
                key={item.id}
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '9px 10px',
                  borderRadius: 'var(--sp-radius)',
                }}
              >
                <span style={{ fontSize: 16, lineHeight: '20px' }} aria-hidden="true">
                  {item.icon}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 13,
                      color: toneColorMap[item.tone] || toneColorMap.default,
                    }}
                  >
                    {item.text}
                  </span>
                  <span style={{ fontSize: 11 }} className="sp-muted">
                    {formatActivityTime(item.timestamp)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default LiveActivityFeed;
