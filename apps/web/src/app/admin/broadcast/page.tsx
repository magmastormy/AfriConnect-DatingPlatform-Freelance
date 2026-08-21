'use client';

import { useState } from 'react';
import { adminApi, AdminApiError } from '@/lib/adminApi';
import { useToast } from '@/components/Toast';
import { Card, Button, Input, Textarea, Select } from '@/components/ui';
import { NotificationChannel, UserRole } from '@/lib/shared';
import { validateRequired, sanitizeText } from '@/lib/validate';

export default function BroadcastPage() {
  const toast = useToast();
  const [type, setType] = useState('announcement');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [channel, setChannel] = useState<NotificationChannel>(NotificationChannel.InApp);
  const [role, setRole] = useState<UserRole | ''>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function send() {
    const e: Record<string, string> = {};
    const t = validateRequired(title, 'Title');
    if (t) e.title = t;
    const b = validateRequired(body, 'Message');
    if (b) e.body = b;
    const linkTrimmed = link.trim();
    if (linkTrimmed && !/^(\/|https?:\/\/)/.test(linkTrimmed)) {
      e.link = 'Link must start with "/" or "https://"';
    }
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      const res = await adminApi.broadcast({
        type: sanitizeText(type),
        title: sanitizeText(title),
        body: sanitizeText(body),
        link: linkTrimmed || undefined,
        channel,
        role: role || undefined,
      });
      toast(`Broadcast queued${res.queued ? ` to ${res.queued} members` : ''}`, 'success');
      setTitle('');
      setBody('');
      setLink('');
    } catch (err) {
      toast(err instanceof AdminApiError ? err.message : 'Broadcast failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Broadcast Notification</h1>
        <p>
          Send a targeted announcement to members by role. Content scope is limited to messaging and
          events.
        </p>
      </div>
      <Card title="Compose">
        <Input
          label="Type"
          value={type}
          onChange={(e) => setType(e.currentTarget.value)}
          placeholder="announcement"
        />
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          className={errors.title ? 'input-error' : ''}
        />
        {errors.title && <div className="field-error">{errors.title}</div>}
        <Textarea
          label="Message"
          value={body}
          onChange={(e) => setBody(e.currentTarget.value)}
          className={errors.body ? 'input-error' : ''}
        />
        {errors.body && <div className="field-error">{errors.body}</div>}
        <Input
          label="Link (optional)"
          value={link}
          onChange={(e) => setLink(e.currentTarget.value)}
          placeholder="/get-vetted or https://…"
          className={errors.link ? 'input-error' : ''}
        />
        {errors.link && <div className="field-error">{errors.link}</div>}
        <p className="vet-hint" style={{ marginTop: '-0.4rem', marginBottom: '1rem' }}>
          The bell shows an &ldquo;Open&nbsp;&rarr;&rdquo; button on this notification that routes
          members here.
        </p>
        <div className="grid2">
          <Select
            label="Channel"
            value={channel}
            onChange={(e) => setChannel(e.currentTarget.value as NotificationChannel)}
          >
            {Object.values(NotificationChannel).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            label="Limit to role (optional)"
            value={role}
            onChange={(e) => setRole(e.currentTarget.value as UserRole)}
          >
            <option value="">All members</option>
            {Object.values(UserRole).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
        <Button disabled={busy} onClick={send}>
          Send broadcast
        </Button>
      </Card>
    </div>
  );
}
