'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ApiState } from '@/components/ui';
import type { PublicPersona } from '@/lib/types';
import './companions.css';

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.8 4.9L18.5 9.7 13.8 11.5 12 16.4 10.2 11.5 5.5 9.7 10.2 7.9z" />
      <path d="M19 14l.8 2.2L22 17l-2.2 1.1L19 20l-.8-2.2L16 17l2.2-1.1z" />
    </svg>
  );
}

function avatarInitial(name: string): string {
  return (name || '?').charAt(0).toUpperCase();
}

export default function CompanionsPage() {
  const { user } = useAuth();
  const [personas, setPersonas] = useState<PublicPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsVetting, setNeedsVetting] = useState(false);

  useEffect(() => {
    if (!user) return; // PortalShell gates the page tree on the session
    void (async () => {
      try {
        const res = await api.listPersonas();
        setPersonas(res.personas);
      } catch (e) {
        // A 403 means the account is not yet vetted — the backend refuses the
        // surface. Show the verification nudge (same as Discover/Matches) rather
        // than a raw error string.
        if (e instanceof ApiError && e.status === 403) {
          setNeedsVetting(true);
          return;
        }
        const msg = e instanceof ApiError ? e.message : 'Failed to load companions';
        // A 404 here means the backend module is not mounted (MOCK_CHAT_ENABLED
        // != 'true') — say so plainly instead of a generic error.
        if (e instanceof ApiError && e.status === 404) {
          setError('AI companions are not enabled on this server.');
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  return (
    <div className="companions-wrap">
      <div className="companions-head">
        <h1>AI Demo Companions</h1>
        <p>Chat with roleplay personas to feel out the experience before meeting real members.</p>
      </div>

      <div className="companion-banner" role="note">
        <span className="companion-banner-ico"><SparkleIcon /></span>
        <span>
          <b>These are AI demos — not real people.</b>
          Personas are powered by an LLM and respond automatically. Anything they say is generated,
          not from a real member. Real connections happen under Discover &amp; Matches.
        </span>
      </div>

      {needsVetting ? (
        <div className="companion-vet-gate">
          <span className="vet-gate-ico"><SparkleIcon /></span>
          <h2>Verification required</h2>
          <p>AI companions are part of the verified member experience. Finish verification to start chatting with them.</p>
          <Link href="/get-vetted" className="btn btn-primary">Get vetted</Link>
        </div>
      ) : (
      <ApiState
        loading={loading}
        error={error}
        empty={!loading && !error && personas.length === 0}
        emptyText="No companions available right now."
      >
        <div className="companion-grid">
          {personas.map((p) => (
            <Link key={p.id} href={`/portal/companions/${p.id}`} className="companion-card">
              <div className="companion-card-top">
                <span className="companion-card-avatar">
                  {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : avatarInitial(p.displayName)}
                </span>
                <span>
                  <span className="companion-card-name">
                    {p.displayName}
                    <span className="companion-badge">AI</span>
                  </span>
                  <span className="companion-card-sub">
                    {p.background.age} · {p.background.city} · {p.background.profession}
                  </span>
                </span>
              </div>
              <p className="companion-card-bio">{p.background.bio}</p>
              <div className="companion-chips">
                {p.interests.slice(0, 4).map((i) => (
                  <span key={i} className="companion-chip">{i}</span>
                ))}
              </div>
              <span className="companion-card-cta">Start a chat →</span>
            </Link>
          ))}
        </div>
      </ApiState>
      )}
    </div>
  );
}
