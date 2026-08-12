'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { Button, Input } from '@/components/ui';
import { validateEmail, validateRequired, sanitizeText } from '@/lib/validate';
import { ApiState } from '@/components/ui';

export default function ContactPage() {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    const e: Record<string, string> = {};
    const n = validateRequired(name, 'Name');
    if (n) e.name = n;
    const em = validateEmail(email);
    if (em) e.email = em;
    if (message.trim().length < 10) e.message = 'Please add a little more detail (10+ characters)';
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sanitizeText(name),
          email: sanitizeText(email),
          message: sanitizeText(message),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not send');
      setSent(true);
      toast('Message sent — we will be in touch', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not send', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="prose" style={{ paddingTop: '2.5rem' }}>
      <h1>Contact us</h1>
      <p className="updated">We typically reply within two business days.</p>

      <ApiState loading={false} error={null}>
        {sent ? (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Thank you.</h2>
            <p>Your message is with the team. If it is urgent, email support@africonnect.pro.</p>
          </div>
        ) : (
          <div className="card">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              className={errors.name ? 'input-error' : ''}
              placeholder="Your name"
            />
            {errors.name && <div className="field-error">{errors.name}</div>}
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              className={errors.email ? 'input-error' : ''}
              placeholder="you@company.com"
            />
            {errors.email && <div className="field-error">{errors.email}</div>}
            <div className="field">
              <span>Message</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.currentTarget.value)}
                className={errors.message ? 'input-error' : ''}
                rows={5}
                placeholder="How can we help?"
              />
            </div>
            {errors.message && <div className="field-error">{errors.message}</div>}
            <Button onClick={submit} disabled={busy || !name || !email || !message}>
              {busy ? 'Sending…' : 'Send message'}
            </Button>
          </div>
        )}
      </ApiState>

      <h2>Other ways to reach us</h2>
      <p>
        Support: support@africonnect.pro
        <br />
        Press &amp; partnerships: partners@africonnect.pro
        <br />
        Vetting team: vetting@africonnect.pro
      </p>
    </div>
  );
}
