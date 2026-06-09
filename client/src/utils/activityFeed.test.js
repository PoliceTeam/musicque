import { describe, it, expect } from 'vitest';
import {
  formatActivityItem,
  prependActivityItem,
  formatActivityTime,
  MAX_ACTIVITY_ITEMS,
} from './activityFeed';

describe('activityFeed utils', () => {
  it('formats song added activity', () => {
    const item = formatActivityItem({
      id: '1',
      type: 'song_added',
      timestamp: '2026-06-09T10:00:00.000Z',
      username: 'Alice',
      songTitle: 'Test Song',
    });

    expect(item.text).toContain('Alice');
    expect(item.text).toContain('Test Song');
    expect(item.icon).toBe('🎵');
  });

  it('formats vote cast activity for upvote', () => {
    const item = formatActivityItem({
      id: '2',
      type: 'vote_cast',
      timestamp: '2026-06-09T10:00:00.000Z',
      username: 'Bob',
      voteType: 'up',
      voteAction: 'added',
      songTitle: 'Hit Song',
      voteScore: 3,
    });

    expect(item.text).toContain('upvote');
    expect(item.text).toContain('3 điểm');
  });

  it('prepends activity and keeps max length', () => {
    const existing = Array.from({ length: MAX_ACTIVITY_ITEMS }, (_, index) => ({
      id: `old-${index}`,
      text: `item-${index}`,
    }));

    const next = prependActivityItem(existing, {
      id: 'new',
      type: 'session_started',
      timestamp: '2026-06-09T10:00:00.000Z',
      username: 'Admin',
    });

    expect(next).toHaveLength(MAX_ACTIVITY_ITEMS);
    expect(next[0].text).toContain('mở phiên phát nhạc');
  });

  it('formats activity time safely', () => {
    expect(formatActivityTime('invalid')).toBe('');
    expect(formatActivityTime('2026-06-09T10:15:30.000Z')).toMatch(/\d{2}:\d{2}/);
  });
});
