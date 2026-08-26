'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { EventView } from '@/lib/types';

/**
 * Live preview of upcoming public events on the marketing landing page. Fetched
 * client-side so the static page stays fast; degrades silently if the API is
 * unreachable. Reuses the public /events catalogue (published + future only).
 */
export function HomeEventsPreview() {
  const [events, setEvents] = useState<EventView[]>([]);
  const [loading, setLoading] = useState(true);
  // Distinguishes "the API failed" from "there are genuinely no events". Without
  // this, an unreachable API rendered the "No public events scheduled" copy,
  // which asserts something untrue about the calendar.
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const list = await api.get<EventView[]>('/events');
        if (active) setEvents(list.slice(0, 3));
      } catch {
        /* landing page degrades gracefully — the section is omitted below */
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return null;
  // Omit the whole section rather than claim the calendar is empty.
  if (failed) return null;

  return (
    <section className="page" style={{ paddingTop: 0 }}>
      <div className="section-rule">
        <span className="idx">§ 04b</span>
        <h2>Upcoming events</h2>
      </div>
      {events.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>
          No public events scheduled right now — new dates land every month.{' '}
          <Link href="/events">See the full calendar</Link>.
        </p>
      ) : (
        <div className="event-grid">
          {events.map((ev) => (
            <Link key={ev.id} className="event-card" href="/events">
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
      <div style={{ marginTop: '1.25rem' }}>
        <Link className="btn btn-subtle" href="/events">
          All events
        </Link>
      </div>
    </section>
  );
}
