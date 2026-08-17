'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { EventView } from '@/lib/types';

/**
 * Public events catalogue.
 *
 * The event list/detail endpoints are intentionally public (only the attendee
 * roster and RSVP are gated), so this page renders real data for prospective
 * members and unvetted accounts. It doubles as the marketing surface for the
 * community's hosted events.
 */
export function PublicEventsList() {
  const [events, setEvents] = useState<EventView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const list = await api.get<EventView[]>('/events');
        setEvents(list);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load events');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="state">
        <span className="spinner" aria-label="Loading" />
      </div>
    );
  }

  return (
    <section className="page">
      <header className="page-head">
        <h1>Events</h1>
        <p className="page-lede">
          Hosted mixers, salons and retreats for verified members. Members see who is attending and
          can RSVP; everyone can browse the calendar.
        </p>
      </header>

      {error && <div className="notice">{error}</div>}

      {events.length === 0 ? (
        <div className="empty-state">
          <p>No upcoming events right now. New dates are added every month.</p>
          <Link className="btn btn-primary" href="/sign-up">
            Create account to attend
          </Link>
        </div>
      ) : (
        <div className="event-grid">
          {events.map((ev) => (
            <Link key={ev.id} className="event-card" href={`/events/${ev.id}`}>
              <div className="event-card-top">
                <span className="badge badge-neutral">{ev.eventType}</span>
                {ev.featured && <span className="badge badge-good">Featured</span>}
              </div>
              <h3>{ev.title}</h3>
              <p className="event-card-meta">
                {new Date(ev.startTime).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                · {ev.city}
                <br />
                <strong>{ev.venueName}</strong> · R
                {typeof ev.ticketPrice === 'number' ? ev.ticketPrice.toFixed(2) : ev.ticketPrice} ·
                Capacity {ev.capacity}
              </p>
              <p className="event-card-desc">{ev.description.slice(0, 140)}…</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
