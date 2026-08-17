export type ThemeSetting = 'light' | 'dark' | 'system';
/** What the setting actually resolves to once the OS preference is applied. */
export type ResolvedTheme = 'light' | 'dark';

export const THEME_COOKIE = 'africonnect.theme';

export function isThemeSetting(value: unknown): value is ThemeSetting {
  return value === 'light' || value === 'dark' || value === 'system';
}
