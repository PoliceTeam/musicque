import { describe, it, expect } from 'vitest';
import {
  resolveUserVoteFromSong,
  voteEntryBelongsToUser,
  buildUserVoteMapFromPlaylist,
} from './userVote';

describe('userVote utils', () => {
  it('giữ vote theo ID sau đổi tên và không nhận vote của người lấy tên cũ', () => {
    const entry = { userId: { _id: 'u1', username: 'old_name' } };
    expect(voteEntryBelongsToUser(entry, 'new_name', 'u1')).toBe(true);
    expect(voteEntryBelongsToUser(entry, 'old_name', 'u2')).toBe(false);
  });

  it('matches populated voter username', () => {
    const song = {
      _id: 'song-1',
      votes: [{ type: 'up', userId: { _id: 'u1', username: 'adminx' } }],
    };

    expect(resolveUserVoteFromSong(song, 'adminx')).toBe('up');
    expect(resolveUserVoteFromSong(song, 'other')).toBeNull();
  });

  it('matches voter by mongo id when username is not populated', () => {
    const song = {
      _id: 'song-1',
      votes: [{ type: 'down', userId: 'user-123' }],
    };

    expect(resolveUserVoteFromSong(song, 'adminx', 'user-123')).toBe('down');
    expect(resolveUserVoteFromSong(song, 'adminx')).toBeNull();
  });

  it('builds vote map from playlist', () => {
    const map = buildUserVoteMapFromPlaylist(
      [
        { _id: 'song-1', votes: [{ type: 'up', userId: { username: 'alice' } }] },
        { _id: 'song-2', votes: [{ type: 'down', userId: 'u2' }] },
      ],
      'alice',
      'u1',
    );

    expect(map['song-1']).toBe('up');
    expect(map['song-2']).toBeUndefined();
  });

  it('checks vote entry ownership', () => {
    expect(
      voteEntryBelongsToUser(
        { userId: { username: 'bob' } },
        'bob',
        null,
      ),
    ).toBe(true);
  });
});
