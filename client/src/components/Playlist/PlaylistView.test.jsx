import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlaylistView from './PlaylistView';
import { renderWithProviders } from '../../test/testUtils';
import { AuthContext } from '../../contexts/AuthContext';

describe('PlaylistView', () => {
  it('renders playlist title and empty state', () => {
    renderWithProviders(
      <MemoryRouter>
        <AuthContext.Provider value={{ username: 'Alice', setUserName: () => {} }}>
          <PlaylistView />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Playlist hiện tại')).toBeInTheDocument();
    expect(screen.getByText('Chưa có bài hát nào trong playlist')).toBeInTheDocument();
  });

  it('renders quick reactions for playlist items', () => {
    renderWithProviders(
      <MemoryRouter>
        <AuthContext.Provider value={{ username: 'Alice', setUserName: () => {} }}>
          <PlaylistView />
        </AuthContext.Provider>
      </MemoryRouter>,
      {
        playlistValue: {
          playlist: [
            {
              _id: 'song-1',
              title: 'Test Track',
              addedBy: { username: 'Bob' },
              votes: [],
              voteScore: 0,
            },
          ],
          getUserVoteForSong: () => null,
          getLastReactionForSong: () => null,
        },
      },
    );

    expect(screen.getByText('Test Track')).toBeInTheDocument();
    expect(screen.getByTestId('quick-reaction-buttons')).toBeInTheDocument();
  });
});
