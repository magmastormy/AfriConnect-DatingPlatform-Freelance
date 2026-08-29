'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { EventView } from '@/lib/types';
import { City, EventType } from '@/lib/shared';

function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
    month: d.toLocaleDateString(undefined, { month: 'short' }),
    day: d.toLocaleDateString(undefined, { day: '2-digit' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    full: d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
  };
}

function cityLabel(c: string) {
  return c.replace(/_/g, ' ').replace(/\b\w/g, (s) => s.toUpperCase());
}

function typeLabel(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (s) => s.toUpperCase());
}

const CITY_OPTIONS = Object.values(City);
const TYPE_OPTIONS = Object.values(EventType);

function SkeletonGrid() {
  return (
    <div className="events-grid">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="ev-card ev-skeleton">
          <div className="ev-date-skel" />
          <div className="ev-body">
            <div className="shimmer" style={{ height: 14, width: '40%', borderRadius: 6 }} />
            <div className="shimmer" style={{ height: 18, width: '85%', borderRadius: 6, marginTop: 10 }} />
            <div className="shimmer" style={{ height: 12, width: '100%', borderRadius: 6, marginTop: 8 }} />
            <div className="shimmer" style={{ height: 12, width: '70%', borderRadius: 6, marginTop: 6 }} />
          </div>
        </div>
      ))}
      <style>{`@keyframes shimmer{0%{opacity:.6}50%{opacity:1}100%{opacity:.6}} .shimmer{background:var(--line); animation:shimmer 1.4s infinite}`}</style>
    </div>
  );
}

export function PublicEventsList() {
  const [events, setEvents] = useState<EventView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [q, setQ] = useState('');
  const [city, setCity] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [detail, setDetail] = useState<EventView | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setError(null);
      try {
        const list = await api.get<EventView[]>('/events');
        if (alive) setEvents(list);
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : 'Failed to load events');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  const filtered = useMemo(() => {
    let out = [...events];
    if (q.trim()) {
      const term = q.trim().toLowerCase();
      out = out.filter((ev) => `${ev.title} ${ev.description} ${ev.venueName} ${ev.city}`.toLowerCase().includes(term));
    }
    if (city !== 'all') out = out.filter((ev) => ev.city === city);
    if (type !== 'all') out = out.filter((ev) => ev.eventType === type);
    if (featuredOnly) out = out.filter((ev) => ev.featured);
    // soonest first
    out.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    return out;
  }, [events, q, city, type, featuredOnly]);

  const featured = useMemo(() => events.find((e) => e.featured) ?? filtered[0] ?? null, [events, filtered]);
  const stats = useMemo(() => {
    const cities = new Set(events.map((e) => e.city)).size;
    const totalAttendees = events.reduce((s, e) => s + (e.attendeeCount ?? 0), 0);
    return { total: events.length, cities, totalAttendees, featured: events.filter((e) => e.featured).length };
  }, [events]);

  if (loading) {
    return (
      <div className="events-page">
        <header className="events-hero">
          <div className="events-hero-inner">
            <p className="events-kicker">Hosted · Vetted · In-person</p>
            <h1>Events</h1>
            <p>Curated mixers, salons and retreats for verified members. Loading the calendar…</p>
          </div>
        </header>
        <div className="events-filters-skel" style={{ height: 48, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, margin: '1rem 0' }} />
        <SkeletonGrid />
      </div>
    );
  }

  return (
    <div className="events-page">
      {/* Hero */}
      <header className="events-hero">
        <div className="events-hero-inner">
          <p className="events-kicker">Hosted · Vetted · In-person</p>
          <h1>Meet beyond the screen</h1>
          <p className="events-lede">
            Hosted mixers, salons and retreats for verified members. Members see who’s attending and can RSVP; everyone can browse the calendar. New dates land every month across South Africa.
          </p>
          <div className="events-stats">
            <span><b>{stats.total}</b> upcoming</span>
            <span><b>{stats.cities}</b> cities</span>
            <span><b>{stats.totalAttendees}</b> RSVPs</span>
            {stats.featured > 0 && <span className="events-stats-featured">{stats.featured} featured</span>}
          </div>
          <div className="events-hero-actions">
            <Link href="/sign-up" className="btn btn-primary">Create account to RSVP</Link>
            <Link href="/portal/events" className="btn btn-ghost" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', borderColor: 'rgba(255,255,255,0.22)' }}>Member view →</Link>
          </div>
        </div>
        <div className="events-hero-illust" aria-hidden>
          <svg viewBox="0 0 200 120" width="100%" height="100%">
            <rect x="10" y="10" width="180" height="100" rx="14" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.14)" />
            <circle cx="50" cy="45" r="18" fill="rgba(255,255,255,0.14)" />
            <circle cx="100" cy="45" r="18" fill="rgba(255,255,255,0.18)" />
            <circle cx="150" cy="45" r="18" fill="rgba(255,255,255,0.12)" />
            <rect x="30" y="75" width="50" height="8" rx="4" fill="rgba(255,255,255,0.18)" />
            <rect x="100" y="75" width="70" height="8" rx="4" fill="rgba(255,255,255,0.12)" />
          </svg>
        </div>
      </header>

      {/* Filters — sticky on desktop */}
      <div className="events-filters">
        <div className="events-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, venue, city…" aria-label="Search events" />
          {q && <button className="events-search-clear" onClick={() => setQ('')} aria-label="Clear">×</button>}
        </div>
        <div className="events-pills">
          <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Filter by city">
            <option value="all">All cities</option>
            {CITY_OPTIONS.map((c) => <option key={c} value={c}>{cityLabel(c)}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
            <option value="all">All types</option>
            {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
          </select>
          <button className={`events-pill ${featuredOnly ? 'is-on' : ''}`} onClick={() => setFeaturedOnly((v) => !v)} aria-pressed={featuredOnly}>Featured</button>
          {(q || city !== 'all' || type !== 'all' || featuredOnly) && (
            <button className="events-pill ghost" onClick={() => { setQ(''); setCity('all'); setType('all'); setFeaturedOnly(false); }}>Clear</button>
          )}
          <span className="events-count">{filtered.length} events</span>
        </div>
      </div>

      {/* Featured hero */}
      {featured && !q && city === 'all' && type === 'all' && !featuredOnly && (
        <div className="ev-featured">
          <div className="ev-featured-date">
            {(() => { const d = formatDate(featured.startTime); return (<><span className="ev-featured-month">{d.month.toUpperCase()}</span><span className="ev-featured-day">{d.day}</span><span className="ev-featured-weekday">{d.weekday}</span></>); })()}
          </div>
          <div className="ev-featured-body">
            <div className="ev-featured-top">
              <span className="badge badge-neutral">{typeLabel(featured.eventType)}</span>
              <span className="badge badge-good">Featured</span>
              <span className="ev-featured-city">{cityLabel(featured.city)} · {formatDate(featured.startTime).time}</span>
            </div>
            <h2>{featured.title}</h2>
            <p>{featured.description.slice(0, 160)}…</p>
            <div className="ev-featured-meta">
              <span>Location: {featured.venueName}</span>
              <span>R{Number(featured.ticketPrice).toFixed(0)} · {featured.capacity} seats · {featured.attendeeCount} going</span>
            </div>
            <div className="ev-featured-actions">
              <Link href="/sign-up" className="btn btn-primary">RSVP — create account</Link>
              <Link href="/portal/events" className="btn btn-ghost">Open in portal →</Link>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="events-empty">
          <div className="events-empty-ill" aria-hidden>
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none"><rect x="8" y="12" width="64" height="52" rx="12" fill="var(--surface-3)" stroke="var(--line)" /><path d="M24 36h32M24 44h20" stroke="var(--line-strong)" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </div>
          <h3>{error ? 'We couldn’t load the events' : 'No events match your filters'}</h3>
          <p>{error ?? 'Try clearing filters or check back soon — new dates land every month.'}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {error ? (
              <button className="btn btn-subtle" type="button" onClick={() => setReloadKey((key) => key + 1)}>
                Try again
              </button>
            ) : (
              <button className="btn btn-subtle" type="button" onClick={() => { setQ(''); setCity('all'); setType('all'); setFeaturedOnly(false); }}>
                Clear filters
              </button>
            )}
            <Link href="/sign-up" className="btn btn-primary">Create account</Link>
          </div>
        </div>
      ) : (
        <div className="events-grid">
          {filtered.map((ev) => {
            const d = formatDate(ev.startTime);
            return (
              <div
                key={ev.id}
                className={`ev-card ${ev.featured ? 'is-featured' : ''}`}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                aria-label={`Open details for ${ev.title}`}
                onClick={() => setDetail(ev)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail(ev); } }}
              >
                <div className="ev-date">
                  <span className="ev-date-month">{d.month.toUpperCase()}</span>
                  <span className="ev-date-day">{d.day}</span>
                  <span className="ev-date-weekday">{d.weekday}</span>
                </div>
                <div className="ev-body">
                  <div className="ev-top">
                    <span className="badge badge-neutral">{typeLabel(ev.eventType)}</span>
                    {ev.featured && <span className="badge badge-good">Featured</span>}
                    <span className="ev-city">{cityLabel(ev.city)}</span>
                  </div>
                  <h3 className="ev-title">{ev.title}</h3>
                  <p className="ev-desc">{ev.description.slice(0, 110)}…</p>
                  <p className="ev-meta">
                    {d.time} · <strong>{ev.venueName}</strong>
                    <br />
                    R{Number(ev.ticketPrice).toFixed(0)} · {ev.capacity} seats
                  </p>
                  <div className="ev-foot">
                    <span className="ev-going">{ev.attendeeCount} going</span>
                    <button
                      className="ev-cta"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); setDetail(ev); }}
                    >
                      View →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detail && (
        <div className="modal-shell" onClick={() => setDetail(null)}>
          <div className="modal-card" style={{ maxWidth: 560, maxHeight: '92vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={detail.title}>
            <div className="modal-title-row">
              <div className="modal-name">{detail.title}</div>
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>
            </div>
            <div className="ev-top" style={{ margin: '6px 0 10px' }}>
              <span className="badge badge-neutral">{typeLabel(detail.eventType)}</span>
              {detail.featured && <span className="badge badge-good">Featured</span>}
              <span className="badge badge-neutral" style={{ background: 'var(--surface-3)' }}>{cityLabel(detail.city)}</span>
            </div>
            <p style={{ margin: '0 0 8px', color: 'var(--muted)', fontSize: '.92rem' }}>
              {new Date(detail.startTime).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              {' · '}
              {formatDate(detail.startTime).time} – {formatDate(detail.endTime).time}
            </p>
            <p style={{ margin: '0 0 12px' }}>Location: <strong>{detail.venueName}</strong></p>
            <p style={{ margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>{detail.description}</p>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.9rem' }}>
              R{Number(detail.ticketPrice).toFixed(0)} · {detail.capacity} seats · {detail.attendeeCount} going
            </p>
            <div className="row-actions" style={{ marginTop: 14 }}>
              <Link href="/sign-up" className="btn btn-primary">Create account to RSVP</Link>
              <Link href="/portal/events" className="btn btn-ghost">Member view →</Link>
            </div>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--muted)', fontSize: '.85rem' }}>
        Members see attendees and can RSVP from <Link href="/portal/events">the portal</Link>.
      </div>
    </div>
  );
}
