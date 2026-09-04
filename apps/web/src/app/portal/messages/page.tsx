'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { ApiState } from '@/components/ui';
import { ChatMessage, ConversationThread } from '@/lib/types';
import { useChatSocket } from '@/lib/useChatSocket';

const RECALL_MS = 30 * 60 * 1000;

const EMOJIS: string[] = [
  // Smileys
  '😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','😉','😌','😍','🥰',
  '😘','😗','😙','😚','😋','😛','😜','🤪','😝','🤗','🤩','🥳','😎','🤓','🧐',
  '😏','🙄','🤔','🤫','😬','🤐','🥴','😵','🤯','😴','🤤','😪','😷','🤒',
  // Hearts / romance
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','💕','💞','💓','💗','💖',
  '💘','💝','💟','♥️','💋','🌹','🌷','🌸','🌺','🥀','💐','🎀','✨','💫',
  // Gestures / reactions
  '👍','👎','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇',
  '☝️','✋','🤚','🖐️','👋','🤝','🙏','💪','💯','🔥','⭐','🌟','💎','👀','🙈',
  // Celebration / life
  '🎉','🎊','🥂','🍾','🎁','🍕','🍔','🌮','🍣','🍜','🍰','🧁','☕','🍵',
  '🍷','🍸','🧋','✈️','🏝️','🌅','🏃','🚗','🎵','🎬','📸',
];

function previewOf(m: ConversationThread['lastMessage'], youId: string | undefined): string {
  if (!m) return 'No messages yet';
  if (m.isDeleted) return m.recalledAt ? 'Message recalled' : 'This message was deleted';
  const prefix = m.senderId === youId ? 'You: ' : '';
  if (m.imageUrl) return `${prefix}Photo`;
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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [showAiBanner, setShowAiBanner] = useState(true);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const list = await api.get<ConversationThread[]>('/chat/conversations');
        setConversations(list);
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        // Deep links: ?c=<conversationId> or ?with=<other member's userId>
        // (the Matches page links straight into a member's thread).
        const byId = params.get('c');
        const withUser = params.get('with');
        let found =
          list.find((c) => c.id === byId) ??
          (withUser ? list.find((c) => c.other?.userId === withUser) : undefined);
        // A fresh mutual match may not have a thread yet — create it on the
        // spot so "Message" never silently lands on someone else's chat.
        if (!found && withUser) {
          try {
            const init = await api.createConversation(withUser);
            const refreshed = await api.get<ConversationThread[]>('/chat/conversations');
            setConversations(refreshed);
            found = refreshed.find((c) => c.id === init.id);
          } catch {
            // Not mutual (any more) — fall through to the default selection.
          }
        }
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

  // Dismiss emoji picker when tapping outside (mobile-friendly)
  useEffect(() => {
    if (!emojiOpen) return;
    function onDocClick(e: MouseEvent | TouchEvent) {
      const el = emojiPickerRef.current;
      if (el && !el.contains(e.target as Node)) setEmojiOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchend', onDocClick as EventListener, { passive: true });
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setEmojiOpen(false); };
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchend', onDocClick as EventListener);
      document.removeEventListener('keydown', onEsc);
    };
  }, [emojiOpen]);

  function insertEmoji(ch: string) {
    const inp = inputRef.current;
    if (!inp) { setDraft((d) => d + ch); return; }
    const start = inp.selectionStart ?? draft.length;
    const end = inp.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + ch + draft.slice(end);
    setDraft(next);
    // restore caret right after the inserted emoji
    requestAnimationFrame(() => {
      inp.focus();
      const pos = start + ch.length;
      try { inp.setSelectionRange(pos, pos); } catch { /* ignore */ }
    });
  }

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
      {/* NOTE: do NOT gate the whole page on `empty`. With zero conversations
          (normal in a fresh prototype) ApiState would swallow its children and
          hide the banner + the entire chat shell. The shell always renders; the
          left list carries its own "no conversations" hint and the right pane
          shows the welcome card when nothing is selected. */}
      <ApiState loading={loading} error={error}>
        {showAiBanner && (
          <div className="ai-test-banner" role="status">
            <span className="ai-test-banner-ico" aria-hidden>🤖</span>
            <span className="ai-test-banner-text">
              Prototype mode — your messages are answered by an AI playing the other person. It’s just for testing.
            </span>
            <button
              className="ai-test-banner-close"
              type="button"
              onClick={() => setShowAiBanner(false)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}
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
                        <span className="wa-thread-name">{c.other?.displayName ?? 'Member'} {c.other?.verified && <span className="wa-verified" title="Verified">Verified</span>}</span>
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
              {filtered.length === 0 && (
                <div className="wa-empty-hint">
                  {conversations.length === 0
                    ? 'No conversations yet. Match with people on Discover, then say hello here.'
                    : 'No chats in this filter.'}
                </div>
              )}
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
                </header>

                <div className="wa-scroll" ref={scrollRef}>
                  <div className="wa-wallpaper" aria-hidden />
                  {loadingThread ? (
                    <div className="wa-skeleton">
                      {Array.from({ length: 6 }).map((_, i) => <div key={i} className={`wa-skel ${i % 2 ? 'mine' : ''}`} />)}
                    </div>
                  ) : (
                    <>
                      <div className="wa-date-sep"><span>Messages are end-to-end encrypted</span></div>
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
                                    <span className="wa-deleted">{m.recalledAt ? 'You deleted this message' : 'This message was deleted'}</span>
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
                    <button
                      className={`wa-emoji ${emojiOpen ? 'is-open' : ''}`}
                      aria-label="Toggle emoji picker"
                      aria-expanded={emojiOpen}
                      type="button"
                      onClick={() => setEmojiOpen((o) => !o)}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <circle cx="12" cy="12" r="9"/>
                        <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                        <line x1="9" y1="9" x2="9.01" y2="9" strokeLinecap="round" strokeWidth="2.4"/>
                        <line x1="15" y1="9" x2="15.01" y2="9" strokeLinecap="round" strokeWidth="2.4"/>
                      </svg>
                    </button>
                  </div>
                  {emojiOpen && (
                    <div ref={emojiPickerRef} className="wa-emoji-picker" role="dialog" aria-label="Emoji picker">
                      <div className="wa-emoji-grid" role="listbox">
                        {EMOJIS.map((e) => (
                          <button
                            key={e}
                            type="button"
                            className="wa-emoji-cell"
                            onClick={() => insertEmoji(e)}
                            aria-label={`Insert ${e}`}
                            onMouseDown={(ev) => ev.preventDefault()} /* don't steal input focus */
                          >{e}</button>
                        ))}
                      </div>
                    </div>
                  )}
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
