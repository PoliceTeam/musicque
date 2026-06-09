import { describe, it, expect, vi } from 'vitest';
import { screen, act } from '@testing-library/react';
import LiveActivityFeed from './LiveActivityFeed';
import { renderWithProviders } from '../../test/testUtils';

describe('LiveActivityFeed', () => {
  it('shows empty state when session is inactive', () => {
    renderWithProviders(<LiveActivityFeed />);
    expect(screen.getByText('Chờ phiên phát nhạc để xem hoạt động')).toBeInTheDocument();
  });

  it('renders incoming socket activity events', () => {
    const handlers = {};
    const socket = {
      on: vi.fn((event, handler) => {
        handlers[event] = handler;
      }),
      off: vi.fn(),
    };

    renderWithProviders(<LiveActivityFeed />, {
      playlistValue: {
        currentSession: { _id: 'session-1' },
        socket,
      },
    });

    act(() => {
      handlers.activity_event({
        id: 'evt-1',
        type: 'song_added',
        timestamp: '2026-06-09T10:00:00.000Z',
        username: 'Alice',
        songTitle: 'New Song',
      });
    });

    expect(screen.getByText(/Alice đã thêm "New Song"/)).toBeInTheDocument();
  });
});
