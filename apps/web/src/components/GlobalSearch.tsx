'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { GlobalSearchResult } from '@/lib/types';

export function GlobalSearch() {
  const [q, setQ] = useState('');
  const [result, setResult] = useState<GlobalSearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResult(null);
      setOpen(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          setResult(await api.globalSearch(term));
          setOpen(true);
        } catch {
          /* ignore */
        } finally {
          setLoading(false);
        }
      })();
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const total =
    (result?.members.length ?? 0) +
    (result?.applications.length ?? 0) +
    (result?.subscriptions.length ?? 0);

  return (
    <div className="search-wrap" ref={ref}>
      <input
        className="search-input"
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        placeholder="Search members, applications, plans…"
        onFocus={() => result && setOpen(true)}
      />
      {open && result && (
        <div className="popover search-results">
          {loading && <div className="state">Searching…</div>}
          {!loading && total === 0 && <div className="state">No matches.</div>}
          {!loading && result.members.length > 0 && (
            <div className="search-group">
              <div className="search-group-title">Members</div>
              {result.members.map((m) => (
                <Link
                  key={m.id}
                  href="/admin/members"
                  className="search-hit"
                  onClick={() => setOpen(false)}
                >
                  {m.firstName} {m.lastName} — {m.role}/{m.status}
                </Link>
              ))}
            </div>
          )}
          {!loading && result.applications.length > 0 && (
            <div className="search-group">
              <div className="search-group-title">Applications</div>
              {result.applications.map((a) => (
                <Link
                  key={a.id}
                  href="/admin/applications"
                  className="search-hit"
                  onClick={() => setOpen(false)}
                >
                  {a.firstName} {a.lastName} — {a.status}
                </Link>
              ))}
            </div>
          )}
          {!loading && result.subscriptions.length > 0 && (
            <div className="search-group">
              <div className="search-group-title">Subscriptions</div>
              {result.subscriptions.map((s) => (
                <Link
                  key={s.userId}
                  href="/admin/subscriptions"
                  className="search-hit"
                  onClick={() => setOpen(false)}
                >
                  {s.plan} — {s.status}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
