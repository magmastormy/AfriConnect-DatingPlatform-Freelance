'use client';

import { useEffect, useState } from 'react';
import { adminApi, AdminApiError } from '@/lib/adminApi';
import { Card, ApiState, Button, Badge } from '@/components/ui';
import type { EventView } from '@/lib/types';
import { EventStatus } from '@/lib/shared';

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setEvents(await adminApi.listEvents());
      } catch (e) {
        setError(e instanceof AdminApiError ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function moderate(id: string, data: { status?: EventStatus; featured?: boolean }) {
    setBusyId(id);
    try {
      await adminApi.moderateEvent(id, data);
      setEvents(await adminApi.listEvents());
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Moderation failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Event Moderation</h1>
        <p>Publish, feature, or cancel platform events.</p>
      </div>
      <ApiState loading={loading} error={error} empty={events.length === 0}>
        {events.map((ev) => (
          <Card
            key={ev.id}
            title={ev.title}
            action={
              <Badge
                tone={
                  ev.status === EventStatus.Published
                    ? 'good'
                    : ev.status === EventStatus.Cancelled
                      ? 'bad'
                      : 'warn'
                }
              >
                {ev.status}
              </Badge>
            }
          >
            <div
              className="row-actions"
              style={{ flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}
            >
              <Badge tone="neutral">{ev.eventType}</Badge>
              <span style={{ color: 'var(--muted)' }}>
                {ev.city} · {new Date(ev.startTime).toLocaleDateString()}
              </span>
              {ev.featured && <Badge tone="warn">Featured</Badge>}
            </div>
            <div className="row-actions">
              {ev.status === EventStatus.Draft || ev.status === EventStatus.Pending ? (
                <Button
                  disabled={busyId === ev.id}
                  onClick={() => moderate(ev.id, { status: EventStatus.Published })}
                >
                  Publish
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  disabled={busyId === ev.id}
                  onClick={() => moderate(ev.id, { status: EventStatus.Cancelled })}
                >
                  Cancel
                </Button>
              )}
              <Button
                variant="subtle"
                disabled={busyId === ev.id}
                onClick={() => moderate(ev.id, { featured: !ev.featured })}
              >
                {ev.featured ? 'Unfeature' : 'Feature'}
              </Button>
            </div>
          </Card>
        ))}
      </ApiState>
    </div>
  );
}
