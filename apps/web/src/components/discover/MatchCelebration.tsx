'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/Toast';

/**
 * Shown when the viewer's like/superlike completes a mutual match. Offers to
 * jump straight into the new conversation (lazily created) — the core
 * "start messaging a person" moment of the mobile flow.
 */
export function MatchCelebration({ userId, onClose }: { userId: string; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const { id } = await api.post<{ id: string }>('/chat/conversations', { targetId: userId });
      router.push(`/portal/messages?c=${id}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not start the chat', 'error');
      setBusy(false);
    }
  };

  return (
    <div className="fs-celebrate-shell">
      <div className="fs-celebrate">
        <div className="fs-celebrate-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor" width="34" height="34">
            <path d="M12 21s-7.5-4.6-10-9.3C.6 8.9 2 5.5 5.2 5.5c2 0 3.3 1.1 4.1 2.4l.7 1 .7-1c.8-1.3 2.1-2.4 4.1-2.4 3.2 0 4.6 3.4 3.2 6.2C19.5 16.4 12 21 12 21z" />
          </svg>
        </div>
        <h2>It’s a match!</h2>
        <p>You and this member like each other. Say hello.</p>
        <button className="btn btn-primary" type="button" disabled={busy} onClick={send}>
          {busy ? 'Opening chat…' : 'Send a message'}
        </button>
        <button className="btn btn-ghost" type="button" onClick={onClose}>
          Keep swiping
        </button>
      </div>
    </div>
  );
}
