import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import NowPlayingBar from './NowPlayingBar';
import { renderWithProviders } from '../../test/testUtils';

describe('NowPlayingBar', () => {
  it('renders nothing when there is no active session', () => {
    const { container } = renderWithProviders(<NowPlayingBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders current song details when session is active', () => {
    renderWithProviders(<NowPlayingBar />, {
      playlistValue: {
        currentSession: { _id: 'session-1' },
        currentSong: {
          _id: 'song-1',
          title: 'Bohemian Rhapsody',
          youtubeId: 'abc123',
          message: 'Hello team',
          addedBy: { username: 'alice', displayName: 'Alice' },
        },
        skipState: {
          songId: 'song-1',
          total: 65,
          threshold: 100,
          remaining: 35,
          myContribution: 25,
          status: 'collecting',
        },
      },
    });

    expect(screen.getByTestId('now-playing-bar')).toBeInTheDocument();
    expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Đang phát')).toBeInTheDocument();
    expect(screen.getByText('Next bài này!')).toBeInTheDocument();
    expect(screen.getByText('65/100 PCs')).toBeInTheDocument();
    expect(screen.getByText('để next bài!')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '65');
  });
});
