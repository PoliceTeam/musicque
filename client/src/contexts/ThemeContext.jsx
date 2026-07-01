import React, { createContext, useState, useEffect, useContext } from 'react';
import { theme } from 'antd';

export const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) {
      return saved === 'dark';
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const { defaultAlgorithm, darkAlgorithm } = theme;

  const antdTheme = {
    algorithm: isDark ? darkAlgorithm : defaultAlgorithm,
    token: {
      fontFamily: `'BeVietnamPro', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif`,
      borderRadius: 16,
      colorBgBase: isDark ? '#141414' : '#ffffff',
      colorBgContainer: isDark ? '#1c1c1c' : '#ffffff',
      colorBgElevated: isDark ? '#262626' : '#ffffff',
      colorText: isDark ? 'rgba(255, 255, 255, 0.85)' : '#213547',
      colorTextSecondary: isDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.45)',
      colorBorder: isDark ? '#303030' : '#f0f0f0',
      colorBorderSecondary: isDark ? '#262626' : '#f5f5f5',
      boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 24px rgba(0,0,0,0.04)',
      boxShadowSecondary: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.02)',
    },
    components: {
      Card: {
        paddingLG: 24,
      },
      Button: {
        borderRadius: 12,
        controlHeight: 40,
      },
      Input: {
        borderRadius: 12,
        controlHeight: 40,
      }
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        toggleTheme,
        antdTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
