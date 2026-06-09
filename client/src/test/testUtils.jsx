import React from 'react';
import { render } from '@testing-library/react';
import { PlaylistContext } from '../contexts/PlaylistContext';
import { ThemeContext } from '../contexts/ThemeContext';

const defaultThemeValue = {
  isDark: false,
  toggleTheme: () => {},
};

export const renderWithProviders = (
  ui,
  {
    playlistValue = {},
    themeValue = defaultThemeValue,
  } = {},
) => {
  const playlistContextValue = {
    playlist: [],
    currentSession: null,
    currentSong: null,
    loading: false,
    socket: null,
    voteSong: async () => true,
    ...playlistValue,
  };

  return render(
    <ThemeContext.Provider value={themeValue}>
      <PlaylistContext.Provider value={playlistContextValue}>
        {ui}
      </PlaylistContext.Provider>
    </ThemeContext.Provider>,
  );
};
