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
          title: 'Bohemian Rhapsody',
          youtubeId: 'abc123',
          message: 'Hello team',
          addedBy: { username: 'Alice' },
        },
      },
    });

    expect(screen.getByTestId('now-playing-bar')).toBeInTheDocument();
    expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });
});
