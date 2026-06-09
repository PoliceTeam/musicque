export const MAX_ACTIVITY_ITEMS = 50;

export const formatActivityItem = (event) => {
  if (!event?.type) {
    return null;
  }

  switch (event.type) {
    case 'song_added':
      return {
        id: event.id,
        timestamp: event.timestamp,
        icon: '🎵',
        text: `${event.username} đã thêm "${event.songTitle}"`,
        tone: 'success',
      };
    case 'vote_cast': {
      const voteLabel = event.voteType === 'up' ? 'upvote' : 'downvote';
      if (event.voteAction === 'removed') {
        return {
          id: event.id,
          timestamp: event.timestamp,
          icon: '↩️',
          text: `${event.username} đã bỏ ${voteLabel} "${event.songTitle}"`,
          tone: 'default',
        };
      }
      return {
        id: event.id,
        timestamp: event.timestamp,
        icon: event.voteType === 'up' ? '👍' : '👎',
        text: `${event.username} ${event.voteAction === 'changed' ? 'đổi' : 'đã'} ${voteLabel} "${event.songTitle}" (${event.voteScore ?? 0} điểm)`,
        tone: event.voteType === 'up' ? 'success' : 'warning',
      };
    }
    case 'now_playing':
      return {
        id: event.id,
        timestamp: event.timestamp,
        icon: '▶️',
        text: `Đang phát: "${event.songTitle}"${event.username ? ` — ${event.username}` : ''}`,
        tone: 'processing',
      };
    case 'session_started':
      return {
        id: event.id,
        timestamp: event.timestamp,
        icon: '🎉',
        text: `${event.username} đã mở phiên phát nhạc`,
        tone: 'success',
      };
    case 'session_ended':
      return {
        id: event.id,
        timestamp: event.timestamp,
        icon: '🛑',
        text: `${event.username} đã kết thúc phiên phát nhạc`,
        tone: 'default',
      };
    default:
      return null;
  }
};

export const prependActivityItem = (items, event, maxItems = MAX_ACTIVITY_ITEMS) => {
  const formatted = formatActivityItem(event);
  if (!formatted) {
    return items;
  }

  const next = [formatted, ...items.filter((item) => item.id !== formatted.id)];
  return next.slice(0, maxItems);
};

export const formatActivityTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
};
