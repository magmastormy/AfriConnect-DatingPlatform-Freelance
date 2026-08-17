'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, ApiState, Button, Badge, Input, Select, Textarea } from '@/components/ui';
import { EventView } from '@/lib/types';
import { EventStatus, EventType, City } from '@/lib/shared';

interface Attendee {
  userId: string;
  firstName: string;
  profession: string;
}

const EVENT_TYPES = Object.values(EventType);
const CITIES = Object.values(City);

interface EventForm {
  title: string;
  description: string;
  eventType: string;
  city: string;
  venueName: string;
  venueAddress: string;
  startTime: string;
  endTime: string;
  capacity: number;
  ticketPrice: number;
  dressCode: string;
}

const EMPTY_FORM: EventForm = {
  title: '',
  description: '',
  eventType: 'mixer',
  city: 'johannesburg',
  venueName: '',
  venueAddress: '',
  startTime: '',
  endTime: '',
  capacity: 50,
  ticketPrice: 0,
  dressCode: '',
};

function statusTone(s: EventStatus): 'neutral' | 'good' | 'warn' | 'bad' {
  if (s === EventStatus.Published) return 'good';
  if (s === EventStatus.Cancelled) return 'bad';
  if (s === EventStatus.Pending) return 'warn';
  return 'neutral';
}

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventView[]>([]);
  const [myEvents, setMyEvents] = useState<EventView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rsvpd, setRsvpd] = useState<Record<string, string>>({});
  const [openAttendees, setOpenAttendees] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Record<string, Attendee[]>>({});
  const [starred, setStarred] = useState<Record<string, boolean>>({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [list, mine] = await Promise.all([
          api.get<EventView[]>('/events'),
          api.get<EventView[]>('/events/mine'),
        ]);
        setEvents(list);
        setMyEvents(mine);
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

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    setFormBusy(true);
    setFormError(null);
    try {
      if (!form.startTime || !form.endTime) throw new Error('Start and end time are required');
      const body = {
        title: form.title,
        description: form.description,
        eventType: form.eventType,
        city: form.city,
        venueName: form.venueName,
        venueAddress: form.venueAddress,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        capacity: Number(form.capacity),
        ticketPrice: Number(form.ticketPrice),
        dressCode: form.dressCode || undefined,
      };
      await api.createEvent(body);
      setMyEvents(await api.get<EventView[]>('/events/mine'));
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch (e) {
      setFormError(
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Submission failed',
      );
    } finally {
      setFormBusy(false);
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
        {!showForm && (
          <Button variant="subtle" onClick={() => setShowForm(true)}>
            Host an event
          </Button>
        )}
      </div>

      {showForm && (
        <Card title="Host a new event">
          <form onSubmit={submitForm} className="stack">
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <Textarea
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
            <div className="row-actions" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
              <Select
                label="Type"
                value={form.eventType}
                onChange={(e) => setForm({ ...form, eventType: e.target.value })}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <Select
                label="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div className="row-actions" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
              <Input
                label="Venue name"
                value={form.venueName}
                onChange={(e) => setForm({ ...form, venueName: e.target.value })}
                required
              />
              <Input
                label="Venue address"
                value={form.venueAddress}
                onChange={(e) => setForm({ ...form, venueAddress: e.target.value })}
                required
              />
            </div>
            <div className="row-actions" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
              <Input
                label="Starts"
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                required
              />
              <Input
                label="Ends"
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                required
              />
            </div>
            <div className="row-actions" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
              <Input
                label="Capacity"
                type="number"
                min={1}
                max={1000}
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                required
              />
              <Input
                label="Ticket price (ZAR)"
                type="number"
                min={0}
                value={form.ticketPrice}
                onChange={(e) => setForm({ ...form, ticketPrice: Number(e.target.value) })}
                required
              />
              <Input
                label="Dress code"
                value={form.dressCode}
                onChange={(e) => setForm({ ...form, dressCode: e.target.value })}
              />
            </div>
            {formError && <div className="notice">{formError}</div>}
            <div className="row-actions">
              <Button type="submit" disabled={formBusy}>
                Submit for review
              </Button>
              <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              New events are submitted for admin review and appear publicly once approved.
            </p>
          </form>
        </Card>
      )}

      {myEvents.length > 0 && (
        <Card title="My submissions">
          <div className="stack">
            {myEvents.map((ev) => (
              <div
                key={ev.id}
                className="row-actions"
                style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}
              >
                <span>
                  <strong>{ev.title}</strong> · {ev.city}
                </span>
                <Badge tone={statusTone(ev.status)}>{ev.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

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
                  <div className="match" key={a.userId}>
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
