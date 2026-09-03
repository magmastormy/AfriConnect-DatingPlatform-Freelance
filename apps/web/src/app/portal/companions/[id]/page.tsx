'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import type { ChatMessage, PublicPersona } from '@/lib/types';
import '../companions.css';

function avatarInitial(name: string): string {
  return (name || '?').charAt(0).toUpperCase();
}

export default function CompanionChatPage() {
  const params = useParams<{ id: string }>();
  const personaId = params?.id as string;
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [persona, setPersona] = useState<PublicPersona | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsVetting, setNeedsVetting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Open (or resume) the thread, load history, then mark read.
  useEffect(() => {
    if (!user || !personaId) return;
    let cancelled = false;
    void (async () => {
      try {
        // The persona fetch is 403-safe: an unvetted account is refused, so flag
        // the gate instead of swallowing the error into a null persona.
        const p = await api.getPersona(personaId).catch((err) => {
          if (err instanceof ApiError && err.status === 403) setNeedsVetting(true);
          return null;
        });
        if (cancelled) return;
        if (p) setPersona(p);

        const conv = await api.createMockConversation(personaId);
        if (cancelled) return;
        setConversationId(conv.id);

        const { messages: m } = await api.getMockMessages(conv.id);
        if (cancelled) return;
        setMessages(m);
        await api.markMockRead(conv.id).catch(() => {});
      } catch (e) {
        if (cancelled) return;
        // A 403 from any of the above means the account is not yet vetted.
        if (e instanceof ApiError && e.status === 403) {
          setNeedsVetting(true);
          return;
        }
        if (e instanceof ApiError && e.status === 404) {
          setError('That companion no longer exists.');
        } else {
          setError(e instanceof ApiError ? e.message : 'Failed to open chat');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, personaId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing, loading]);

  async function send() {
    if (!conversationId || !draft.trim() || busy || !user) return;
    const text = draft.trim();
    const tempId = `tmp-${Date.now()}`;
    setDraft('');
    setBusy(true);
    setTyping(true);

    // Optimistic bubble so the UI feels instant.
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        senderId: user.userId,
        content: text,
        imageUrl: null,
        status: 'sent',
        isEdited: false,
        editedAt: null,
        isDeleted: false,
        recalledAt: null,
        createdAt: new Date().toISOString(),
      } as ChatMessage,
    ]);

    try {
      // The POST resolves only AFTER the persona has auto-responded (the server
      // awaits Groq + a short typing delay, which can take many seconds — hence
      // the long client timeout on this call). The returned body is its reply,
      // so no separate polling loop is needed.
      await api.sendMockMessage(conversationId, text);
      const { messages: m } = await api.getMockMessages(conversationId);
      setMessages(m);
      setTyping(false);
      await api.markMockRead(conversationId).catch(() => {});
    } catch (e) {
      // The persona reply is generated server-side and is saved even if the
      // client gave up on the POST (abort / timeout / network drop). Read back
      // whatever the server holds so a delivered message — and any late reply —
      // still appears instead of vanishing.
      const readback = await api.getMockMessages(conversationId).catch(() => null);
      const delivered = readback?.messages.some(
        (msg) => msg.senderId === user.userId && !msg.isDeleted && msg.content === text,
      );

      if (readback) {
        // Authoritative list replaces the optimistic bubble (it contains the
        // real saved message, and the reply if it already landed).
        setMessages(readback.messages);
      } else {
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      }

      if (delivered) {
        // Message is safe on the server; no need to alarm the user. A reply that
        // landed is already in the list above.
        setTyping(false);
      } else {
        // Truly failed to send — restore the draft and surface the error.
        setDraft(text);
        setTyping(false);
        toast(e instanceof ApiError ? e.message : 'Send failed', 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  const displayName = persona?.displayName ?? 'Companion';
  const avatar = persona?.avatarUrl ?? null;
  const userId = user?.userId ?? '';

  // Unvetted accounts are refused by the backend with a 403. Show the
  // verification gate rather than a dead chat pane with a non-functional composer.
  if (needsVetting) {
    return (
      <div className="wa-page">
        <section className="wa-pane companion-pane">
          <div className="companion-vet-gate">
            <span className="vet-gate-ico">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </span>
            <h2>Verification required</h2>
            <p>AI companions are for verified members. Finish verification to chat with them.</p>
            <button type="button" className="btn btn-primary" onClick={() => router.push('/get-vetted')}>Get vetted</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="wa-page">
      <section className="wa-pane companion-pane">
        <header className="wa-pane-head">
          <button className="wa-back" onClick={() => router.push('/portal/companions')} aria-label="Back to companions">‹</button>
          <span className="wa-pane-avatar">
            {avatar ? <img src={avatar} alt="" /> : avatarInitial(displayName)}
          </span>
          <span className="wa-pane-meta">
            <b>
              {displayName} <span className="companion-badge">AI</span>
            </b>
            <span className="wa-pane-status">
              <span className="ai-dot" />auto-replying · demo
            </span>
          </span>
        </header>

        <div className="wa-scroll" ref={scrollRef}>
          <div className="wa-wallpaper" aria-hidden />

          {loading && (
            <div className="companion-empty-hint">
              <span className="spinner" style={{ width: 22, height: 22 }} />
            </div>
          )}

          {!loading && error && (
            <div className="companion-empty-hint" role="alert">{error}</div>
          )}

          {!loading && !error && messages.length === 0 && !typing && (
            <div className="companion-empty-hint">
              Say hi to {displayName}. This is an AI demo companion — replies are generated, not from a real person.
            </div>
          )}

          {!loading && !error && messages.map((m) => {
            const mine = m.senderId === userId;
            return (
              <div key={m.id} className={`wa-row ${mine ? 'mine' : 'theirs'}`}>
                <div className={`wa-bubble ${mine ? 'mine' : 'theirs'}`}>
                  {m.imageUrl && <img className="wa-bubble-img" src={m.imageUrl} alt="shared" />}
                  <span className="wa-text">{m.content}</span>
                  <span className="wa-bubble-meta">
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}

          {typing && (
            <div className="wa-row theirs">
              <div className="wa-bubble theirs">
                <span className="companion-typing" aria-label="typing">
                  <i /><i /><i />
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="companion-ai-note">AI-generated demo replies · not a real member</div>

        <div className="wa-composer">
          <div className="wa-input-wrap">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message ${displayName}…`}
              aria-label="Message"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
          </div>
          {draft.trim() ? (
            <button className="wa-send" onClick={send} disabled={busy} aria-label="Send">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            </button>
          ) : (
            <button className="wa-send muted" aria-label="Voice (coming soon)" onClick={() => toast('Voice messages coming soon', 'info')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" /><path d="M19 10a7 7 0 0 1-14 0" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" /></svg>
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
