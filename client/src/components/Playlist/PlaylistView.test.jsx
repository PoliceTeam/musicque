import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlaylistView from './PlaylistView';
import { renderWithProviders } from '../../test/testUtils';

describe('PlaylistView', () => {
  it('nhắc khách đăng nhập khi hàng chờ trống', () => {
    renderWithProviders(
      <MemoryRouter>
        <PlaylistView />
      </MemoryRouter>,
    );

    expect(screen.getByText('Hàng chờ')).toBeInTheDocument();
    expect(screen.getByText('Hàng chờ đang trống')).toBeInTheDocument();
    expect(
      screen.getByText('Đăng nhập để trở thành người thêm bài đầu tiên.'),
    ).toBeInTheDocument();
  });

  it('renders quick reactions for playlist items', () => {
    renderWithProviders(
      <MemoryRouter>
        <PlaylistView />
      </MemoryRouter>,
      {
        authValue: { isAuthenticated: true, username: 'alice', displayName: 'Alice' },
        playlistValue: {
          playlist: [
            {
              _id: 'song-1',
              title: 'Test Track',
              youtubeId: 'abc123',
              addedBy: { username: 'bob', displayName: 'Bob' },
              votes: [],
              voteScore: 0,
            },
          ],
        },
      },
    );

    expect(screen.getByText('Test Track')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByTestId('quick-reaction-buttons')).toBeInTheDocument();
  });
});
