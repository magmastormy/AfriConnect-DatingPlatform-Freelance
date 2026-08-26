import Link from 'next/link';
import { ReactNode } from 'react';

type Tone = 'match' | 'superlike' | 'info';

const TONE_CLASS: Record<Tone, string> = {
  match: 'awareness awareness-match',
  superlike: 'awareness awareness-superlike',
  info: 'awareness awareness-info',
};

/**
 * A short, action-oriented directive that makes a relationship event visible —
 * a mutual match, an incoming superlike, or an unread prompt. Used consistently
 * across Discover, Matches and Messenger so members always know what to do next.
 */
export function AwarenessBanner({
  tone = 'info',
  icon,
  title,
  children,
  cta,
}: {
  tone?: Tone;
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  cta?: { label: string; href: string };
}) {
  return (
    <div className={TONE_CLASS[tone]} role="status">
      {icon && <span className="awareness-icon" aria-hidden>{icon}</span>}
      <div className="awareness-body">
        <strong className="awareness-title">{title}</strong>
        {children && <span className="awareness-text">{children}</span>}
      </div>
      {cta && (
        <Link href={cta.href} className="btn btn-primary awareness-cta">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
