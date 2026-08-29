'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ApiState, Button, Badge, Input, Select, Textarea } from '@/components/ui';
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
  title: '', description: '', eventType: 'mixer', city: 'johannesburg',
  venueName: '', venueAddress: '', startTime: '', endTime: '', capacity: 50, ticketPrice: 0, dressCode: '',
};
function statusTone(s: EventStatus): 'neutral' | 'good' | 'warn' | 'bad' {
  if (s === EventStatus.Published) return 'good';
  if (s === EventStatus.Cancelled) return 'bad';
  if (s === EventStatus.Pending) return 'warn';
  return 'neutral';
}
function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString(undefined, { month: 'short' }),
    day: d.toLocaleDateString(undefined, { day: '2-digit' }),
    weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  };
}
function cityLabel(c: string) { return c.replace(/_/g, ' ').replace(/\b\w/g, (s) => s.toUpperCase()); }
function typeLabel(t: string) { return t.replace(/_/g, ' ').replace(/\b\w/g, (s) => s.toUpperCase()); }

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventView[]>([]);
  const [myEvents, setMyEvents] = useState<EventView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rsvpd, setRsvpd] = useState<Record<string, string>>({});
  const [attendees, setAttendees] = useState<Record<string, Attendee[]>>({});
  const [starred, setStarred] = useState<Record<string, boolean>>({});
  const [attendeeEvent, setAttendeeEvent] = useState<EventView | null>(null);
  const [detailEvent, setDetailEvent] = useState<EventView | null>(null);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [city, setCity] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [featuredOnly, setFeaturedOnly] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [list, mine] = await Promise.all([
          api.get<EventView[]>('/events'),
          api.get<EventView[]>('/events/mine'),
        ]);
        setEvents(list); setMyEvents(mine);
      } catch (e) { setError(e instanceof ApiError ? e.message : 'Failed to load events'); }
      finally { setLoading(false); }
    })();
  }, []);

  // Escape closes the host sheet
  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowForm(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showForm]);

  const filtered = useMemo(() => {
    let out = [...events];
    if (q.trim()) {
      const term = q.trim().toLowerCase();
      out = out.filter((ev) => `${ev.title} ${ev.description} ${ev.venueName} ${ev.city}`.toLowerCase().includes(term));
    }
    if (city !== 'all') out = out.filter((ev) => ev.city === city);
    if (type !== 'all') out = out.filter((ev) => ev.eventType === type);
    if (featuredOnly) out = out.filter((ev) => ev.featured);
    out.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    return out;
  }, [events, q, city, type, featuredOnly]);

  const featured = useMemo(() => events.find((e) => e.featured) ?? filtered[0] ?? null, [events, filtered]);

  async function rsvp(id: string) {
    setBusyId(id);
    try {
      const res = await api.post<{ status: string; waitlisted: boolean }>(`/events/${id}/rsvp`);
      setRsvpd((p) => ({ ...p, [id]: res.waitlisted ? 'waitlist' : 'confirmed' }));
    } catch (e) { setError(e instanceof ApiError ? e.message : 'RSVP failed'); }
    finally { setBusyId(null); }
  }
  async function openAttendees(ev: EventView) {
    setAttendeeEvent(ev); setAttendeesLoading(true);
    try {
      if (!attendees[ev.id]) {
        const list = await api.get<Attendee[]>(`/events/${ev.id}/attendees`);
        setAttendees((p) => ({ ...p, [ev.id]: list }));
      }
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Failed to load attendees'); }
    finally { setAttendeesLoading(false); }
  }
  async function star(evId: string, starreeId: string) {
    setBusyId(`${evId}:${starreeId}`);
    try { await api.post(`/events/${evId}/star`, { starreeId }); setStarred((p) => ({ ...p, [`${evId}:${starreeId}`]: true })); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Star failed'); }
    finally { setBusyId(null); }
  }
  async function submitForm(e: FormEvent) {
    e.preventDefault(); setFormBusy(true); setFormError(null);
    try {
      if (!form.startTime || !form.endTime) throw new Error('Start and end time are required');
      const body = {
        title: form.title, description: form.description, eventType: form.eventType, city: form.city,
        venueName: form.venueName, venueAddress: form.venueAddress,
        startTime: new Date(form.startTime).toISOString(), endTime: new Date(form.endTime).toISOString(),
        capacity: Number(form.capacity), ticketPrice: Number(form.ticketPrice), dressCode: form.dressCode || undefined,
      };
      await api.createEvent(body);
      setMyEvents(await api.get<EventView[]>('/events/mine'));
      setShowForm(false); setForm(EMPTY_FORM);
    } catch (e) { setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Submission failed'); }
    finally { setFormBusy(false); }
  }

  const rsvpCount = Object.keys(rsvpd).length;

  return (
    <div className="events-page portal-events">
      {/* Header */}
      <div className="events-hero" style={{ padding: '1.2rem 1.25rem' }}>
        <div className="events-hero-inner" style={{ maxWidth: 'none' }}>
          <div>
            <p className="events-kicker">Members · RSVP · Star</p>
            <h1 style={{ fontSize: '1.7rem', margin: '0.2rem 0 0.4rem' }}>Events</h1>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.82)', maxWidth: '56ch' }}>
              Exclusive mixers for verified members. RSVP to lock your spot, star attendees you’re curious about, or host your own.
            </p>
          </div>
          <div className="events-hero-actions" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <Button variant="subtle" onClick={() => setShowForm(true)}><span aria-hidden>+</span> Host an event</Button>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: '.78rem', color: 'rgba(255,255,255,0.9)' }}>
              <span className="badge" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }}>{events.length} upcoming</span>
              {rsvpCount > 0 && <span className="badge" style={{ background: 'var(--good-bg)', color: 'var(--good-fg)' }}>{rsvpCount} RSVP’d</span>}
              {myEvents.length > 0 && <span className="badge" style={{ background: 'var(--warn-bg)', color: 'var(--warn-fg)' }}>{myEvents.length} submissions</span>}
            </div>
          </div>
        </div>
      </div>

      {/* My submissions strip */}
      {myEvents.length > 0 && (
        <div className="events-mine-strip">
          <span className="events-mine-label">My submissions</span>
          <div className="events-mine-scroll">
            {myEvents.map((ev) => (
              <span key={ev.id} className="events-mine-chip">
                <strong>{ev.title}</strong> · {cityLabel(ev.city)} <Badge tone={statusTone(ev.status)}>{ev.status}</Badge>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="events-filters">
        <div className="events-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, venue…" aria-label="Search events" />
          {q && <button className="events-search-clear" onClick={() => setQ('')} aria-label="Clear">×</button>}
        </div>
        <div className="events-pills">
          <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="City">
            <option value="all">All cities</option>
            {CITIES.map((c) => <option key={c} value={c}>{cityLabel(c)}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
            <option value="all">All types</option>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
          </select>
          <button className={`events-pill ${featuredOnly ? 'is-on' : ''}`} onClick={() => setFeaturedOnly((v) => !v)}>Featured</button>
          {(q || city !== 'all' || type !== 'all' || featuredOnly) && <button className="events-pill ghost" onClick={() => { setQ(''); setCity('all'); setType('all'); setFeaturedOnly(false); }}>Clear</button>}
          <span className="events-count">{filtered.length} events</span>
        </div>
      </div>

      {/* Host sheet */}
      {showForm && (
        <div className="modal-shell" onClick={() => setShowForm(false)}>
          <div className="modal-card ev-host-modal" role="dialog" aria-modal="true" aria-label="Host a new event" onClick={(e) => e.stopPropagation()}>
            <div className="ev-host-head">
              <div>
                <div className="modal-name">Host a new event</div>
                <p className="modal-sub">Submitted for admin review — appears publicly once approved.</p>
              </div>
              <button className="ev-host-close" onClick={() => setShowForm(false)} aria-label="Close" type="button">×</button>
            </div>
            <form onSubmit={submitForm} className="ev-host-body">
              <div className="ev-host-section">
                <p className="ev-host-legend">The basics</p>
                <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
              </div>
              <div className="ev-host-section">
                <p className="ev-host-legend">Where &amp; when</p>
                <div className="grid2">
                  <Select label="Type" value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })}>{EVENT_TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}</Select>
                  <Select label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>{CITIES.map((c) => <option key={c} value={c}>{cityLabel(c)}</option>)}</Select>
                  <Input label="Venue name" value={form.venueName} onChange={(e) => setForm({ ...form, venueName: e.target.value })} required />
                  <Input label="Venue address" value={form.venueAddress} onChange={(e) => setForm({ ...form, venueAddress: e.target.value })} required />
                  <Input label="Starts" type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
                  <Input label="Ends" type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required />
                </div>
              </div>
              <div className="ev-host-section">
                <p className="ev-host-legend">Capacity &amp; pricing</p>
                <div className="grid2">
                  <Input label="Capacity" type="number" min={1} max={1000} value={String(form.capacity)} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} required />
                  <Input label="Ticket price (ZAR)" type="number" min={0} value={String(form.ticketPrice)} onChange={(e) => setForm({ ...form, ticketPrice: Number(e.target.value) })} required />
                  <span style={{ gridColumn: '1 / -1' }}>
                    <Input label="Dress code" value={form.dressCode} onChange={(e) => setForm({ ...form, dressCode: e.target.value })} />
                  </span>
                </div>
              </div>
              {formError && <div className="notice" style={{ margin: 0 }}>{formError}</div>}
              <div className="ev-host-foot">
                <Button type="submit" disabled={formBusy}>{formBusy ? 'Submitting…' : 'Submit for review'}</Button>
                <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ApiState loading={loading} error={error} empty={filtered.length === 0} emptyText="No events match your filters.">
        {featured && !q && city === 'all' && type === 'all' && !featuredOnly && (
          <div className="ev-featured" style={{ marginTop: '1rem' }}>
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
              <div className="ev-featured-meta"><span>Location: {featured.venueName}</span><span>R{Number(featured.ticketPrice).toFixed(0)} · {featured.attendeeCount} going</span></div>
              <div className="ev-featured-actions">
                {rsvpd[featured.id] ? <Badge tone="good">{rsvpd[featured.id] === 'waitlist' ? 'Waitlisted' : 'Confirmed'}</Badge> : <Button disabled={busyId === featured.id} onClick={() => rsvp(featured.id)}>RSVP</Button>}
                <Button variant="ghost" onClick={() => openAttendees(featured)}>View attendees ({featured.attendeeCount})</Button>
              </div>
            </div>
          </div>
        )}

        <div className="events-grid">
          {filtered.map((ev) => {
            const d = formatDate(ev.startTime);
            const isRsvpd = !!rsvpd[ev.id];
            return (
              <div
                key={ev.id}
                className={`ev-card ${ev.featured ? 'is-featured' : ''}`}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                aria-label={`Open details for ${ev.title}`}
                onClick={() => setDetailEvent(ev)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailEvent(ev); } }}
              >
                <div className="ev-date">
                  <span className="ev-date-month">{d.month.toUpperCase()}</span>
                  <span className="ev-date-day">{d.day}</span>
                  <span className="ev-date-weekday">{d.weekday}</span>
                  <span className="ev-date-time">{d.time}</span>
                </div>
                <div className="ev-body">
                  <div className="ev-top">
                    <span className="badge badge-neutral">{typeLabel(ev.eventType)}</span>
                    {ev.featured && <span className="badge badge-good">Featured</span>}
                    <span className="badge badge-neutral" style={{ background: 'var(--surface-3)' }}>{cityLabel(ev.city)}</span>
                    <span className={`badge badge-${statusTone(ev.status)}`}>{ev.status}</span>
                  </div>
                  <h3 className="ev-title">{ev.title}</h3>
                  <p className="ev-desc">{ev.description.slice(0, 110)}…</p>
                  <p className="ev-meta"><strong>{ev.venueName}</strong> · R{Number(ev.ticketPrice).toFixed(0)} · {ev.capacity} seats</p>
                  <div className="ev-foot">
                    <span className="ev-going">{ev.attendeeCount} going</span>
                    <div className="row-actions" style={{ gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      {isRsvpd ? <Badge tone="good">{rsvpd[ev.id] === 'waitlist' ? 'Waitlisted' : 'Confirmed'}</Badge> : <Button disabled={busyId === ev.id} onClick={() => rsvp(ev.id)}>RSVP</Button>}
                      <Button variant="ghost" onClick={() => openAttendees(ev)}>Attendees</Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ApiState>

      {attendeeEvent && (
        <div className="modal-shell" onClick={() => setAttendeeEvent(null)}>
          <div className="modal-card attendee-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title-row">
              <div className="modal-name">Attendees</div>
              <button className="btn btn-ghost" onClick={() => setAttendeeEvent(null)}>Close</button>
            </div>
            <p className="modal-sub">{attendeeEvent.title} · {attendeeEvent.attendeeCount} going</p>
            {attendeesLoading ? <div className="state"><span className="spinner" aria-label="Loading" /></div>
              : (attendees[attendeeEvent.id] ?? []).length === 0 ? <p style={{ color: 'var(--muted)' }}>No attendees yet.</p>
                : (
                  <div className="attendee-list">
                    {(attendees[attendeeEvent.id] ?? []).map((a) => (
                      <div className="match" key={a.userId}>
                        <div className="meta"><div><strong>{a.firstName}</strong>{a.profession ? <span style={{ color: 'var(--muted)', fontSize: '.85rem' }}> · {a.profession}</span> : null}</div></div>
                        {starred[`${attendeeEvent.id}:${a.userId}`] ? <Badge tone="good">Starred</Badge>
                          : <Button variant="danger" disabled={busyId === `${attendeeEvent.id}:${a.userId}` || a.userId === user?.userId} onClick={() => star(attendeeEvent.id, a.userId)}>Star</Button>}
                      </div>
                    ))}
                  </div>
                )}
          </div>
        </div>
      )}
      {detailEvent && (
        <div className="modal-shell" onClick={() => setDetailEvent(null)}>
          <div className="modal-card" style={{ maxWidth: 560, maxHeight: '92vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={detailEvent.title}>
            <div className="modal-title-row">
              <div className="modal-name">{detailEvent.title}</div>
              <button className="btn btn-ghost" onClick={() => setDetailEvent(null)}>Close</button>
            </div>
            <div className="ev-top" style={{ margin: '6px 0 10px' }}>
              <span className="badge badge-neutral">{typeLabel(detailEvent.eventType)}</span>
              {detailEvent.featured && <span className="badge badge-good">Featured</span>}
              <span className="badge badge-neutral" style={{ background: 'var(--surface-3)' }}>{cityLabel(detailEvent.city)}</span>
              <span className={`badge badge-${statusTone(detailEvent.status)}`}>{detailEvent.status}</span>
            </div>
            <p style={{ margin: '0 0 8px', color: 'var(--muted)', fontSize: '.92rem' }}>
              {new Date(detailEvent.startTime).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              {' · '}
              {formatDate(detailEvent.startTime).time} – {formatDate(detailEvent.endTime).time}
            </p>
            <p style={{ margin: '0 0 12px' }}>Location: <strong>{detailEvent.venueName}</strong></p>
            <p style={{ margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>{detailEvent.description}</p>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.9rem' }}>
              R{Number(detailEvent.ticketPrice).toFixed(0)} · {detailEvent.capacity} seats · {detailEvent.attendeeCount} going
            </p>
            <div className="row-actions" style={{ marginTop: 14 }}>
              {rsvpd[detailEvent.id]
                ? <Badge tone="good">{rsvpd[detailEvent.id] === 'waitlist' ? 'Waitlisted' : 'Confirmed'}</Badge>
                : <Button disabled={busyId === detailEvent.id} onClick={() => rsvp(detailEvent.id)}>RSVP</Button>}
              <Button variant="ghost" onClick={() => { const ev = detailEvent; setDetailEvent(null); openAttendees(ev); }}>
                View attendees ({detailEvent.attendeeCount})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
