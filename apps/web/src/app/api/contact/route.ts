import { NextResponse } from 'next/server';
import { validateEmail, sanitizeText } from '@/lib/validate';
import { logger } from '@africonnect/shared/logger';

// Contact inquiry collector. Validates and acknowledges so the form is functional
// end-to-end. If CONTACT_WEBHOOK_URL is set (deploy), the inquiry is forwarded to
// it (e.g. Resend/SendGrid inbound or a Slack/Discord webhook); otherwise it is
// logged for the team to action. No external credentials are required locally.
const WEBHOOK = process.env.CONTACT_WEBHOOK_URL;
/** Upper bound on the outbound webhook call so a slow sink cannot stall the response. */
const WEBHOOK_TIMEOUT_MS = 5_000;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
  const { name, email, message } = (body ?? {}) as {
    name?: string;
    email?: string;
    message?: string;
  };
  const emailErr = validateEmail(email ?? '');
  if (!name || !name.trim()) {
    return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
  }
  if (emailErr) {
    return NextResponse.json({ success: false, error: emailErr }, { status: 400 });
  }
  if (!message || message.trim().length < 10) {
    return NextResponse.json(
      { success: false, error: 'Please add a little more detail (10+ characters)' },
      { status: 400 },
    );
  }
  const clean = {
    name: sanitizeText(name).slice(0, 200),
    email: (email ?? '').slice(0, 200),
    message: sanitizeText(message).slice(0, 4000),
  };

  if (WEBHOOK) {
    // Bounded: a hanging webhook must never stall the visitor's request, and a
    // non-2xx response must not be mistaken for a successful forward. The
    // inquiry is logged below regardless, so a failed forward is degraded, not lost.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const res = await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `New inquiry from ${clean.name} <${clean.email}>\n\n${clean.message}`,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        logger.warn({ status: res.status }, '[contact] webhook rejected the forward; logged only');
      }
    } catch (err) {
      logger.warn({ err }, '[contact] webhook forward failed; logged only');
    } finally {
      clearTimeout(timer);
    }
  }
  logger.info({ name: clean.name, email: clean.email }, '[contact] inquiry received');
  return NextResponse.json({ success: true });
}
