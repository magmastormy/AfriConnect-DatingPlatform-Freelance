'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { ApiState } from '@/components/ui';
import { ChatMessage, ConversationThread } from '@/lib/types';
import { useChatSocket } from '@/lib/useChatSocket';

const RECALL_MS = 30 * 60 * 1000;

function previewOf(m: ConversationThread['lastMessage'], youId: string | undefined): string {
  if (!m) return 'No messages yet';
  if (m.isDeleted) return m.recalledAt ? '↩ Message recalled' : 'This message was deleted';
  const prefix = m.senderId === youId ? 'You: ' : '';
  if (m.imageUrl) return `${prefix}📷 Photo`;
  return `${prefix}${m.content}`;
}

function timeLabel(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function Ticks({ status }: { status: string }) {
  const read = status === 'read';
  return (
    <span className={`wa-ticks ${read ? 'read' : ''}`} aria-hidden>
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none"><path d="M1 5.5L4.5 9L9 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M6.5 5.5L10 9L15 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </span>
  );
}

export default function MessagesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [conversations, setConversations] = useState<ConversationThread[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [showActions, setShowActions] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const list = await api.get<ConversationThread[]>('/chat/conversations');
        setConversations(list);
        const target = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('c');
        const found = list.find((c) => c.id === target);
        setActive(found ? found.id : (list[0]?.id ?? null));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load messages');
      } finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!active) return;
    setLoadingThread(true);
    void (async () => {
      try {
        const m = await api.get<ChatMessage[]>(`/chat/conversations/${active}`);
        setMessages(m);
        await api.post(`/chat/conversations/${active}/read`, {});
        // mark unread 0 locally
        setConversations((prev) => prev.map((c) => c.id === active ? { ...c, unread: 0 } : c));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load thread');
      } finally { setLoadingThread(false); }
    })();
  }, [active]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loadingThread]);

  const { connected } = useChatSocket({
    conversationId: active ?? undefined,
    onMessage: (cid, message) => {
      // update thread preview regardless of active
      const raw = message as ChatMessage;
      setConversations((prev) => prev.map((c) => c.id === cid ? { ...c, lastMessage: { id: raw.id, senderId: raw.senderId, content: raw.content, imageUrl: raw.imageUrl ?? null, isDeleted: !!raw.isDeleted, recalledAt: raw.recalledAt ?? null, createdAt: raw.createdAt }, lastMessageAt: raw.createdAt, unread: c.id === active ? 0 : (c.unread ?? 0) + 1 } : c));
      if (cid !== active) return;
      setMessages((prev) => prev.some((m) => m.id === raw.id) ? prev : [...prev, raw]);
    },
  });

  async function send() {
    if (!active || !draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    // optimistic bubble
    const tempId = `tmp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, senderId: user?.userId ?? '', content: text, imageUrl: null, status: 'sent', isEdited: false, editedAt: null, isDeleted: false, recalledAt: null, createdAt: new Date().toISOString() } as ChatMessage]);
    setBusy(true);
    try {
      await api.post(`/chat/conversations/${active}`, { content: text });
      const m = await api.get<ChatMessage[]>(`/chat/conversations/${active}`);
      setMessages(m);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Send failed', 'error');
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
    } finally { setBusy(false); }
  }

  async function uploadImage(file: File) {
    if (!active) return;
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file); });
      const ext = file.type.split('/')[1]?.split('+')[0] || 'png';
      const { url } = await api.post<{ url: string }>('/chat/upload', { data: dataUrl, ext: ext === 'jpeg' ? 'jpg' : ext });
      await api.post(`/chat/conversations/${active}`, { imageUrl: url });
      const m = await api.get<ChatMessage[]>(`/chat/conversations/${active}`);
      setMessages(m);
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Upload failed', 'error'); }
    finally { setUploading(false); }
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return;
    try {
      await api.put(`/chat/conversations/${active}/messages/${id}`, { content: editText.trim() });
      const m = await api.get<ChatMessage[]>(`/chat/conversations/${active}`);
      setMessages(m); setEditing(null);
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Edit failed', 'error'); }
  }
  async function remove(id: string) {
    try { await api.del(`/chat/conversations/${active}/messages/${id}`); const m = await api.get<ChatMessage[]>(`/chat/conversations/${active}`); setMessages(m); } catch (e) { toast(e instanceof ApiError ? e.message : 'Delete failed', 'error'); }
  }
  async function recall(id: string) {
    try { await api.post(`/chat/conversations/${active}/messages/${id}/recall`, {}); const m = await api.get<ChatMessage[]>(`/chat/conversations/${active}`); setMessages(m); toast('Message recalled', 'success'); } catch (e) { toast(e instanceof ApiError ? e.message : 'Recall failed', 'error'); }
  }

  const activeConv = conversations.find((c) => c.id === active);
  const activeName = activeConv?.other?.displayName ?? 'Select a chat';
  const activePhoto = activeConv?.other?.photo ?? null;

  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === 'unread') list = list.filter((c) => (c.unread ?? 0) > 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => (c.other?.displayName ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [conversations, filter, search]);

  const hasActive = !!active;

  return (
    <div className="wa-page">
      <ApiState loading={loading} error={error} empty={conversations.length === 0} emptyText="No conversations yet. Match with people on Discover, then say hello here.">
        <div className={`wa-shell ${hasActive ? 'has-active' : ''}`}>
          {/* ── Left: chat list (WhatsApp Web left pane) ── */}
          <aside className="wa-list" aria-label="Chats">
            <div className="wa-list-head">
              <h2 className="wa-list-title">Chats</h2>
              <div className="wa-list-actions">
                <span className={`wa-conn ${connected ? 'online' : 'offline'}`} title={connected ? 'Live' : 'Reconnecting…'} />
              </div>
            </div>

            <div className="wa-search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search or start new chat" aria-label="Search chats" />
              {search && <button className="wa-search-clear" onClick={() => setSearch('')} aria-label="Clear search">×</button>}
            </div>

            <div className="wa-filters">
              <button className={`wa-pill ${filter === 'all' ? 'is-on' : ''}`} onClick={() => setFilter('all')}>All</button>
              <button className={`wa-pill ${filter === 'unread' ? 'is-on' : ''}`} onClick={() => setFilter('unread')}>Unread</button>
              <span className="wa-pill-count">{filtered.length} chats</span>
            </div>

            <div className="wa-threads">
              {filtered.map((c) => {
                const initial = (c.other?.displayName ?? '?').charAt(0).toUpperCase();
                const isActive = c.id === active;
                return (
                  <button key={c.id} className={`wa-thread ${isActive ? 'is-active' : ''}`} onClick={() => setActive(c.id)}>
                    <span className="wa-avatar">
                      {c.other?.photo ? <img src={c.other.photo} alt="" /> : initial}
                      {c.unread > 0 && <i className="wa-unread-dot" />}
                    </span>
                    <span className="wa-thread-main">
                      <span className="wa-thread-top">
                        <span className="wa-thread-name">{c.other?.displayName ?? 'Member'} {c.other?.verified && <span className="wa-verified" title="Verified">✓</span>}</span>
                        <span className="wa-thread-time">{timeLabel(c.lastMessageAt)}</span>
                      </span>
                      <span className="wa-thread-preview">
                        <span className="wa-preview-text">{previewOf(c.lastMessage, user?.userId)}</span>
                        {c.unread > 0 && <span className="wa-unread-badge">{c.unread > 99 ? '99+' : c.unread}</span>}
                      </span>
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && <div className="wa-empty-hint">No chats in this filter.</div>}
            </div>
          </aside>

          {/* ── Right: conversation pane (WhatsApp Web main) ── */}
          <section className="wa-pane">
            {!active ? (
              <div className="wa-welcome">
                <div className="wa-welcome-card">
                  <div className="wa-welcome-illo" aria-hidden>
                    <svg width="88" height="88" viewBox="0 0 88 88" fill="none"><rect x="6" y="10" width="76" height="56" rx="14" fill="var(--surface-3)" stroke="var(--line)"/><circle cx="44" cy="34" r="14" fill="var(--line)"/><path d="M22 58c3.5-8 14-12 22-12s18.5 4 22 12" stroke="var(--line-strong)" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  </div>
                  <h3>WhatsApp-style messaging</h3>
                  <p>Select a chat to start messaging. Messages are end-to-end encrypted and disappear controls live inside each bubble.</p>
                  <p className="muted" style={{ fontSize: '.82rem' }}>Tap a conversation on the left — on your phone, swipe back to return to the list.</p>
                </div>
              </div>
            ) : (
              <>
                <header className="wa-pane-head">
                  <button className="wa-back" onClick={() => setActive(null)} aria-label="Back to chats">‹</button>
                  <span className="wa-pane-avatar">{activePhoto ? <img src={activePhoto} alt="" /> : activeName.charAt(0).toUpperCase()}</span>
                  <span className="wa-pane-meta">
                    <b>{activeName}</b>
                    <span className="wa-pane-status">{connected ? 'online · encrypted' : 'reconnecting…'}</span>
                  </span>
                  <span className="wa-pane-actions">
                    <button className="wa-icon-btn" aria-label="Voice call" title="Voice call (coming soon)" onClick={() => toast('Voice calls coming soon', 'info')}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.7 19.7 0 0 1 3.1 5.2 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.7l.4 3a2 2 0 0 1-.6 1.7l-1.4 1.4a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 1.7-.6l3 .4A2 2 0 0 1 22 16.9z"/></svg>
                    </button>
                    <button className="wa-icon-btn" aria-label="Video call" title="Video call (coming soon)" onClick={() => toast('Video calls coming soon', 'info')}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><polygon points="23 7 13 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                    </button>
                    <button className="wa-icon-btn" aria-label="More" onClick={() => setShowActions((v) => v ? null : 'pane')}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/><circle cx="12" cy="5" r="1.5"/></svg>
                    </button>
                  </span>
                </header>

                <div className="wa-scroll" ref={scrollRef}>
                  <div className="wa-wallpaper" aria-hidden />
                  {loadingThread ? (
                    <div className="wa-skeleton">
                      {Array.from({ length: 6 }).map((_, i) => <div key={i} className={`wa-skel ${i % 2 ? 'mine' : ''}`} />)}
                    </div>
                  ) : (
                    <>
                      <div className="wa-date-sep"><span>🔒 Messages are end-to-end encrypted</span></div>
                      {(() => {
                        let lastDay = '';
                        return messages.map((m) => {
                          const mine = m.senderId === user?.userId;
                          const day = dayLabel(m.createdAt);
                          const showDay = day !== lastDay;
                          if (showDay) lastDay = day;
                          const canRecall = mine && !m.isDeleted && Date.now() - new Date(m.createdAt).getTime() <= RECALL_MS;
                          return (
                            <div key={m.id}>
                              {showDay && <div className="wa-date-sep"><span>{day}</span></div>}
                              <div className={`wa-row ${mine ? 'mine' : 'theirs'}`}>
                                <div className={`wa-bubble ${mine ? 'mine' : 'theirs'} ${m.isDeleted ? 'deleted' : ''}`}>
                                  {m.isDeleted ? (
                                    <span className="wa-deleted">{m.recalledAt ? '↩ You deleted this message' : 'This message was deleted'}</span>
                                  ) : (
                                    <>
                                      {m.imageUrl && <img className="wa-bubble-img" src={m.imageUrl} alt="shared" />}
                                      {editing === m.id ? (
                                        <div className="wa-edit">
                                          <input value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') void saveEdit(m.id); if (e.key === 'Escape') setEditing(null); }} />
                                          <button className="btn btn-primary" style={{ padding: '6px 10px', fontSize: '.82rem' }} onClick={() => saveEdit(m.id)}>Save</button>
                                          <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '.82rem' }} onClick={() => setEditing(null)}>Cancel</button>
                                        </div>
                                      ) : (
                                        <span className="wa-text">{m.content}</span>
                                      )}
                                      <span className="wa-bubble-meta">
                                        <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        {m.isEdited && <span> · edited</span>}
                                        {mine && !m.isDeleted && <Ticks status={m.status} />}
                                      </span>
                                      {mine && !m.isDeleted && editing !== m.id && (
                                        <span className={`wa-bubble-menu ${showActions === m.id ? 'is-open' : ''}`}>
                                          <button className="wa-menu-trigger" onClick={() => setShowActions(showActions === m.id ? null : m.id)} aria-label="Message actions">⋯</button>
                                          {showActions === m.id && (
                                            <span className="wa-menu">
                                              <button onClick={() => { setEditing(m.id); setEditText(m.content); setShowActions(null); }}>Edit</button>
                                              {canRecall && <button onClick={() => { void recall(m.id); setShowActions(null); }}>Recall</button>}
                                              <button onClick={() => { void remove(m.id); setShowActions(null); }}>Delete</button>
                                            </span>
                                          )}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </>
                  )}
                </div>

                <div className="wa-composer">
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); e.target.value=''; }} />
                  <button className="wa-composer-btn" aria-label="Attach image" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12V7a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-5"/><path d="M16 8l-4 4-4-4"/><path d="M12 12V8"/></svg>
                  </button>
                  <div className="wa-input-wrap">
                    <input
                      ref={inputRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Type a message"
                      aria-label="Message"
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }}}
                    />
                    <button className="wa-emoji" aria-label="Emoji" type="button" onClick={() => { setDraft((d) => d + '😊'); inputRef.current?.focus(); }}>☺</button>
                  </div>
                  {draft.trim() ? (
                    <button className="wa-send" onClick={send} disabled={busy} aria-label="Send">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                  ) : (
                    <button className="wa-send muted" aria-label="Voice message (hold)" onClick={() => toast('Voice messages coming soon', 'info')}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/><path d="M19 10a7 7 0 0 1-14 0"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </ApiState>
    </div>
  );
}
