import React, { createContext, useContext, useState } from 'react';

export type DashboardThemeMode = 'light' | 'dark' | 'slate';

interface ThemeContextType {
  theme: DashboardThemeMode;
  setTheme: (theme: DashboardThemeMode) => void;
  isLight: boolean;
  isDark: boolean;
  isSlate: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {},
  isLight: true,
  isDark: false,
  isSlate: false,
});

export const DashboardThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<DashboardThemeMode>(() => {
    const saved = localStorage.getItem('myps_dashboard_theme') as DashboardThemeMode;
    return saved || 'light';
  });

  const setTheme = (newTheme: DashboardThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem('myps_dashboard_theme', newTheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        isLight: theme === 'light',
        isDark: theme === 'dark',
        isSlate: theme === 'slate',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useDashboardTheme = () => useContext(ThemeContext);
