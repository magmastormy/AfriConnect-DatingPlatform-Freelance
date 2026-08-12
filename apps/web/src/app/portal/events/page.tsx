'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, ApiState, Button, Badge } from '@/components/ui';
import { EventView } from '@/lib/types';
import { EventStatus } from '@/lib/shared';

interface Attendee {
  id: string;
  userId: string;
  firstName: string;
  profession: string;
}

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rsvpd, setRsvpd] = useState<Record<string, string>>({});
  const [openAttendees, setOpenAttendees] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Record<string, Attendee[]>>({});
  const [starred, setStarred] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
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

  async function rsvp(id: string) {
    setBusyId(id);
    try {
      const res = await api.post<{ status: string; waitlisted: boolean }>(`/events/${id}/rsvp`);
      setRsvpd((p) => ({ ...p, [id]: res.waitlisted ? 'waitlist' : 'confirmed' }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'RSVP failed');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAttendees(evId: string) {
    if (openAttendees === evId) {
      setOpenAttendees(null);
      return;
    }
    if (!attendees[evId]) {
      try {
        const list = await api.get<Attendee[]>(`/events/${evId}/attendees`);
        setAttendees((p) => ({ ...p, [evId]: list }));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load attendees');
      }
    }
    setOpenAttendees(evId);
  }

  async function star(evId: string, starreeId: string) {
    setBusyId(`${evId}:${starreeId}`);
    try {
      await api.post(`/events/${evId}/star`, { starreeId });
      setStarred((p) => ({ ...p, [`${evId}:${starreeId}`]: true }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Star failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Events</h1>
        <p>
          Exclusive singles events. RSVP to secure your spot, then star attendees you&apos;re
          interested in.
        </p>
      </div>

      <ApiState loading={loading} error={error} empty={events.length === 0}>
        {events.map((ev) => (
          <Card
            key={ev.id}
            title={ev.title}
            action={ev.featured ? <Badge tone="warn">Featured</Badge> : null}
          >
            <div
              className="row-actions"
              style={{ flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}
            >
              <Badge tone="neutral">{ev.eventType}</Badge>
              <Badge tone={ev.status === EventStatus.Published ? 'good' : 'warn'}>
                {ev.status}
              </Badge>
              <span style={{ color: 'var(--muted)' }}>
                {ev.city} · {new Date(ev.startTime).toLocaleDateString()}
              </span>
            </div>
            <p style={{ color: 'var(--muted)' }}>{ev.description}</p>
            <p style={{ fontSize: '0.9rem' }}>
              <strong>{ev.venueName}</strong> · R{ev.ticketPrice} · Capacity {ev.capacity}
            </p>
            <div className="row-actions">
              {rsvpd[ev.id] ? (
                <Badge tone="good">
                  {rsvpd[ev.id] === 'waitlist' ? 'Waitlisted' : 'Confirmed'}
                </Badge>
              ) : (
                <Button disabled={busyId === ev.id} onClick={() => rsvp(ev.id)}>
                  RSVP
                </Button>
              )}
              <Button variant="ghost" onClick={() => toggleAttendees(ev.id)}>
                View attendees
              </Button>
            </div>

            {openAttendees === ev.id && (
              <div
                style={{
                  marginTop: '1rem',
                  borderTop: '1px solid var(--line)',
                  paddingTop: '1rem',
                }}
              >
                <h3 style={{ marginTop: 0, fontSize: '0.95rem' }}>Attendees</h3>
                {(attendees[ev.id] ?? []).length === 0 && (
                  <p style={{ color: 'var(--muted)' }}>No attendees yet.</p>
                )}
                {(attendees[ev.id] ?? []).map((a) => (
                  <div className="match" key={a.id}>
                    <div className="meta">
                      <div>
                        <strong>{a.firstName}</strong> · {a.profession}
                      </div>
                    </div>
                    {starred[`${ev.id}:${a.userId}`] ? (
                      <Badge tone="good">Starred</Badge>
                    ) : (
                      <Button
                        variant="danger"
                        disabled={busyId === `${ev.id}:${a.userId}` || a.userId === user?.userId}
                        onClick={() => star(ev.id, a.userId)}
                      >
                        ★ Star
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </ApiState>
    </div>
  );
}
