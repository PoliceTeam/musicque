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
    token: isDark
      ? {
          colorBgBase: '#141414',
          colorBgContainer: '#1f1f1f',
          colorBgElevated: '#262626',
          colorText: 'rgba(255, 255, 255, 0.85)',
          colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
          colorBorder: '#434343',
          colorBorderSecondary: '#303030',
        }
      : {},
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
