export const NEUTRAL_VOTE_TYPE = 'neutral';

export const QUICK_REACTIONS = [
  { emoji: '🔥', voteType: 'up', label: 'Fire upvote' },
  { emoji: '👏', voteType: 'up', label: 'Clap upvote' },
  { emoji: '❤️', voteType: 'up', label: 'Heart upvote' },
  { emoji: '⚖️', voteType: NEUTRAL_VOTE_TYPE, label: 'Balanced - remove vote' },
  { emoji: '👎', voteType: 'down', label: 'Downvote' },
];

export const getReactionVoteType = (emoji) => {
  const reaction = QUICK_REACTIONS.find((item) => item.emoji === emoji);
  return reaction?.voteType ?? null;
};

export const getYouTubeThumbnail = (youtubeId) => {
  if (!youtubeId) return null;
  return `https://img.youtube.com/vi/${youtubeId}/default.jpg`;
};

export const shouldRequestVote = (userVote, reaction) => {
  if (reaction.voteType === NEUTRAL_VOTE_TYPE) {
    return userVote !== null;
  }

  if (userVote === reaction.voteType) {
    return false;
  }

  return true;
};

export const isReactionActive = (userVote, reaction, lastReactionEmoji) => {
  if (reaction.voteType === NEUTRAL_VOTE_TYPE) {
    return userVote === null;
  }

  if (userVote !== reaction.voteType) {
    return false;
  }

  if (!lastReactionEmoji) {
    return reaction.voteType === 'down' || reaction.emoji === QUICK_REACTIONS[0].emoji;
  }

  return lastReactionEmoji === reaction.emoji;
};
