'use client';

import { useTheme, type ThemeSetting } from '@/lib/theme';

/**
 * Theme control rendered in the site navigation.
 *
 * Presented as a three-way segmented control (Light / Dark / System) rather
 * than a binary switch, because "System" must remain reachable — a member who
 * has never chosen explicitly should be able to return to following their OS.
 * Uses inline SVG glyphs (no emoji, no icon dependency) so the control inherits
 * currentColor and themes correctly.
 */

const OPTIONS: { value: ThemeSetting; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

function Glyph({ setting }: { setting: ThemeSetting }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (setting === 'light') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (setting === 'dark') {
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Colour theme" data-active={theme}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={theme === opt.value}
          aria-label={`${opt.label} theme`}
          title={`${opt.label} theme`}
          data-selected={theme === opt.value}
          onClick={() => setTheme(opt.value)}
        >
          <Glyph setting={opt.value} />
          <span className="theme-toggle-label">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
