const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return value._id.toString();
  return String(value);
};

export const voteEntryBelongsToUser = (entry, username, voterUserId) => {
  const voter = entry?.userId;
  if (!voter) return false;

  if (typeof voter === 'object' && voter.username) {
    return voter.username === username;
  }

  if (voterUserId) {
    return normalizeId(voter) === voterUserId;
  }

  return false;
};

export const resolveUserVoteFromSong = (song, username, voterUserId) => {
  if (!song?.votes?.length || !username) {
    return null;
  }

  const entry = song.votes.find((vote) =>
    voteEntryBelongsToUser(vote, username, voterUserId),
  );

  return entry?.type ?? null;
};

export const buildUserVoteMapFromPlaylist = (songs, username, voterUserId) => {
  if (!Array.isArray(songs) || !username) {
    return {};
  }

  return songs.reduce((map, song) => {
    const songId = normalizeId(song._id);
    if (!songId) return map;

    const voteType = resolveUserVoteFromSong(song, username, voterUserId);
    if (voteType) {
      map[songId] = voteType;
    }
    return map;
  }, {});
};
