'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ThemeSetting, ResolvedTheme, THEME_COOKIE } from './theme.utils';

export type { ThemeSetting } from './theme.utils';

/**
 * Theme control.
 *
 * Three settings are exposed to the member: 'light', 'dark', and 'system'.
 * 'system' is the default and defers to the operating system via the
 * prefers-color-scheme media query (handled entirely in globals.css).
 *
 * The resolved setting is mirrored onto <html data-theme="..."> so CSS can
 * select on it, and persisted in a cookie (not localStorage) so the server
 * can render the correct palette on the very first paint — no flash of the
 * wrong theme on load.
 *
 * The cookie is intentionally non-sensitive: it holds one of three literal
 * strings, is not HttpOnly (the client toggle must write it), and carries
 * SameSite=Lax so it is not sent on cross-site requests.
 */

const THEME_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

interface ThemeContextValue {
  /** The member's chosen setting, including 'system'. */
  theme: ThemeSetting;
  /** The concrete palette in effect right now. */
  resolved: ResolvedTheme;
  setTheme: (next: ThemeSetting) => void;
  /** Cycles light -> dark -> system, for a single-button control. */
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolve(setting: ThemeSetting, prefersDark: boolean): ResolvedTheme {
  if (setting === 'system') return prefersDark ? 'dark' : 'light';
  return setting;
}

export function ThemeProvider({
  children,
  initialTheme = 'system',
}: {
  children: React.ReactNode;
  initialTheme?: ThemeSetting;
}) {
  const [theme, setThemeState] = useState<ThemeSetting>(initialTheme);
  // Seeded false so server and first client render agree (no hydration
  // mismatch); the effect below corrects it immediately on mount.
  const [prefersDark, setPrefersDark] = useState(false);

  // Track the OS preference so a 'system' member follows it live, without
  // needing a reload when they flip their desktop theme.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setPrefersDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Mirror the setting onto <html> so the CSS selectors in globals.css apply.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemeSetting) => {
    setThemeState(next);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next);
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
    }
  }, []);

  const cycleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light');
  }, [theme, setTheme]);

  const resolved = resolve(theme, prefersDark);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
