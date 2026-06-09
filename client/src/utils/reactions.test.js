import { describe, it, expect } from 'vitest';
import {
  getReactionVoteType,
  getYouTubeThumbnail,
  QUICK_REACTIONS,
  NEUTRAL_VOTE_TYPE,
  shouldRequestVote,
  isReactionActive,
} from './reactions';

describe('reactions utils', () => {
  it('maps emoji to vote type', () => {
    expect(getReactionVoteType('🔥')).toBe('up');
    expect(getReactionVoteType('👎')).toBe('down');
    expect(getReactionVoteType('⚖️')).toBe(NEUTRAL_VOTE_TYPE);
    expect(getReactionVoteType('unknown')).toBeNull();
  });

  it('builds youtube thumbnail url', () => {
    expect(getYouTubeThumbnail('abc123')).toBe(
      'https://img.youtube.com/vi/abc123/default.jpg',
    );
    expect(getYouTubeThumbnail(null)).toBeNull();
  });

  it('defines quick reactions including neutral balance', () => {
    expect(QUICK_REACTIONS.some((item) => item.voteType === NEUTRAL_VOTE_TYPE)).toBe(true);
  });

  it('only requests neutral vote when user already voted', () => {
    const neutral = QUICK_REACTIONS.find((item) => item.voteType === NEUTRAL_VOTE_TYPE);
    const fire = QUICK_REACTIONS[0];

    expect(shouldRequestVote(null, neutral)).toBe(false);
    expect(shouldRequestVote('up', neutral)).toBe(true);
    expect(shouldRequestVote('up', fire)).toBe(false);
    expect(shouldRequestVote(null, fire)).toBe(true);
  });

  it('highlights neutral when there is no vote', () => {
    const neutral = QUICK_REACTIONS.find((item) => item.voteType === NEUTRAL_VOTE_TYPE);
    const fire = QUICK_REACTIONS[0];

    expect(isReactionActive(null, neutral)).toBe(true);
    expect(isReactionActive('up', neutral)).toBe(false);
    expect(isReactionActive('up', fire, '🔥')).toBe(true);
    expect(isReactionActive('up', QUICK_REACTIONS[1], '🔥')).toBe(false);
  });
});
