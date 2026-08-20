import React from 'react';
import { render } from '@testing-library/react';
import { PlaylistContext } from '../contexts/PlaylistContext';
import { ThemeContext } from '../contexts/ThemeContext';
import { AuthContext } from '../contexts/AuthContext';

const defaultThemeValue = {
  isDark: false,
  toggleTheme: () => {},
};

// Mặc định là khách chưa đăng nhập — test nào cần user thì truyền authValue
const defaultAuthValue = {
  user: null,
  loading: false,
  isAuthenticated: false,
  isAdmin: false,
  username: '',
  displayName: '',
  balance: 0,
  setBalance: () => {},
  refreshBalance: async () => {},
  requireAuth: () => true,
  openAuthModal: () => {},
  closeAuthModal: () => {},
  login: async () => ({ ok: true }),
  register: async () => ({ ok: true }),
  logout: () => {},
  authModal: null,
};

export const renderWithProviders = (
  ui,
  {
    playlistValue = {},
    themeValue = defaultThemeValue,
    authValue = {},
  } = {},
) => {
  const playlistContextValue = {
    playlist: [],
    currentSession: null,
    currentSong: null,
    skipState: {
      songId: null,
      total: 0,
      threshold: 100,
      remaining: 100,
      myContribution: 0,
      status: 'collecting',
    },
    contributeToSkip: async () => false,
    loading: false,
    socket: null,
    voteSong: async () => true,
    getUserVoteForSong: () => null,
    getLastReactionForSong: () => null,
    ...playlistValue,
  };

  return render(
    <ThemeContext.Provider value={themeValue}>
      <AuthContext.Provider value={{ ...defaultAuthValue, ...authValue }}>
        <PlaylistContext.Provider value={playlistContextValue}>{ui}</PlaylistContext.Provider>
      </AuthContext.Provider>
    </ThemeContext.Provider>,
  );
};
