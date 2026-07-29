import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { theme } from 'antd';

export const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

// Bảng màu Spotify — phải khớp với biến CSS trong styles/spotify.css
const SPOTIFY_GREEN = '#1db954';

const lightTokens = {
  colorPrimary: SPOTIFY_GREEN,
  colorLink: SPOTIFY_GREEN,
  colorBgBase: '#ffffff',
  colorBgContainer: '#ffffff',
  colorBgElevated: '#ffffff',
  colorBgLayout: '#f5f5f5',
  colorText: '#121212',
  colorTextSecondary: '#6a6a6a',
  colorTextTertiary: '#9b9b9b',
  colorBorder: '#e4e4e4',
  colorBorderSecondary: '#efefef',
  colorError: '#e22134',
};

const darkTokens = {
  colorPrimary: SPOTIFY_GREEN,
  colorLink: SPOTIFY_GREEN,
  colorBgBase: '#121212',
  colorBgContainer: '#181818',
  colorBgElevated: '#282828',
  colorBgLayout: '#000000',
  colorText: '#ffffff',
  colorTextSecondary: '#b3b3b3',
  colorTextTertiary: '#7a7a7a',
  colorBorder: '#2a2a2a',
  colorBorderSecondary: '#242424',
  colorError: '#e22134',
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  const antdTheme = useMemo(
    () => ({
      algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        ...(isDark ? darkTokens : lightTokens),
        borderRadius: 8,
        fontFamily: "'BeVietnamPro', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      },
      components: {
        // Nút bo tròn hoàn toàn như Spotify
        Button: { borderRadius: 500, borderRadiusLG: 500, borderRadiusSM: 500, fontWeight: 600 },
        Input: { borderRadius: 6 },
        Card: { borderRadiusLG: 12 },
        Tabs: { horizontalItemPadding: '8px 0', horizontalItemGutter: 20 },
      },
    }),
    [isDark],
  );

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, antdTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
