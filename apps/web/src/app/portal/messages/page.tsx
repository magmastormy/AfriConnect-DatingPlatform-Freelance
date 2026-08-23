'use client';

import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { Card, ApiState, Button, Input } from '@/components/ui';
import { ChatMessage } from '@/lib/types';
import { useChatSocket } from '@/lib/useChatSocket';

interface Conversation {
  id: string;
  participant1Id: string;
  participant2Id: string;
  lastMessageAt: string | null;
  unreadCountP1: number;
  unreadCountP2: number;
}

const RECALL_MS = 30 * 60 * 1000;

export default function MessagesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const list = await api.get<Conversation[]>('/chat/conversations');
        setConversations(list);
        // Support the ?c=<conversationId> deep link from Discover / Match
        // celebration: open that thread directly when present.
        const target = new URLSearchParams(
          typeof window !== 'undefined' ? window.location.search : '',
        ).get('c');
        const found = list.find((c) => c.id === target);
        setActive(found ? found.id : (list[0]?.id ?? null));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load messages');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!active) return;
    void (async () => {
      try {
        const m = await api.get<ChatMessage[]>(`/chat/conversations/${active}`);
        setMessages(m);
        await api.post(`/chat/conversations/${active}/read`, {});
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load thread');
      }
    })();
  }, [active]);

  const { connected } = useChatSocket({
    conversationId: active ?? undefined,
    onMessage: (cid, message) => {
      if (cid !== active) return;
      setMessages((prev) => {
        const raw = message as ChatMessage;
        if (prev.some((m) => m.id === raw.id)) return prev;
        return [...prev, raw];
      });
    },
  });

  async function send() {
    if (!active || !draft.trim()) return;
    setBusy(true);
    try {
      await api.post(`/chat/conversations/${active}`, { content: draft.trim() });
      const m = await api.get<ChatMessage[]>(`/chat/conversations/${active}`);
      setMessages(m);
      setDraft('');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Send failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    if (!active) return;
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const ext = file.type.split('/')[1]?.split('+')[0] || 'png';
      const { url } = await api.post<{ url: string }>('/chat/upload', {
        data: dataUrl,
        ext: ext === 'jpeg' ? 'jpg' : ext,
      });
      await api.post(`/chat/conversations/${active}`, { imageUrl: url });
      const m = await api.get<ChatMessage[]>(`/chat/conversations/${active}`);
      setMessages(m);
      toast('Image sent', 'success');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return;
    try {
      await api.put(`/chat/conversations/${active}/messages/${id}`, { content: editText.trim() });
      const m = await api.get<ChatMessage[]>(`/chat/conversations/${active}`);
      setMessages(m);
      setEditing(null);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Edit failed', 'error');
    }
  }

  async function remove(id: string) {
    try {
      await api.del(`/chat/conversations/${active}/messages/${id}`);
      const m = await api.get<ChatMessage[]>(`/chat/conversations/${active}`);
      setMessages(m);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Delete failed', 'error');
    }
  }

  async function recall(id: string) {
    try {
      await api.post(`/chat/conversations/${active}/messages/${id}/recall`, {});
      const m = await api.get<ChatMessage[]>(`/chat/conversations/${active}`);
      setMessages(m);
      toast('Message recalled', 'success');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Recall failed', 'error');
    }
  }

  function otherId(c: Conversation): string {
    if (!user) return '';
    return c.participant1Id === user.userId ? c.participant2Id : c.participant1Id;
  }
  function unread(c: Conversation): number {
    if (!user) return 0;
    return c.participant1Id === user.userId ? c.unreadCountP1 : c.unreadCountP2;
  }

  const activeConv = conversations.find((c) => c.id === active);

  return (
    <div>
      <div className="page-head">
        <h1>Messages</h1>
        <p>Encrypted 1:1 conversations with your mutual matches.</p>
      </div>

      <ApiState loading={loading} error={error} empty={conversations.length === 0}>
        <div className="split">
          <Card>
            {conversations.map((c) => (
              <div
                key={c.id}
                className="match"
                style={{ cursor: 'pointer', background: c.id === active ? '#fff7ed' : '#fff' }}
                onClick={() => setActive(c.id)}
              >
                <div className="avatar">{(otherId(c).slice(0, 1) || '?').toUpperCase()}</div>
                <div className="meta">
                  <div>
                    <strong>Member {otherId(c).slice(0, 8)}</strong>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    {c.lastMessageAt
                      ? `Last active ${new Date(c.lastMessageAt).toLocaleDateString()}`
                      : 'No messages yet'}
                  </div>
                </div>
                {unread(c) > 0 && <span className="badge badge-good">{unread(c)} new</span>}
              </div>
            ))}
          </Card>

          <Card title={activeConv ? `Member ${otherId(activeConv).slice(0, 8)}` : 'Conversation'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span
                title={connected ? 'Live' : 'Reconnecting…'}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: connected ? 'var(--brand)' : 'var(--muted)',
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                {connected ? 'Live' : 'Reconnecting…'}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                marginBottom: '1rem',
                maxHeight: 360,
                overflowY: 'auto',
              }}
            >
              {messages.map((m) => {
                const mine = m.senderId === user?.userId;
                const canRecall =
                  mine && !m.isDeleted && Date.now() - new Date(m.createdAt).getTime() <= RECALL_MS;
                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: mine ? 'flex-end' : 'flex-start',
                      background: mine ? '#ffedd5' : '#f3f3f3',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 10,
                      maxWidth: '80%',
                    }}
                  >
                    {m.isDeleted ? (
                      <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                        {m.recalledAt ? 'Message recalled' : 'This message was deleted'}
                      </span>
                    ) : (
                      <>
                        {m.imageUrl && (
                          <img
                            src={m.imageUrl}
                            alt="shared"
                            loading="lazy"
                            decoding="async"
                            style={{
                              maxWidth: 220,
                              borderRadius: 8,
                              display: 'block',
                              marginBottom: 4,
                            }}
                          />
                        )}
                        {editing === m.id ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Input
                              label=""
                              value={editText}
                              onChange={(e) => setEditText(e.currentTarget.value)}
                            />
                            <Button variant="subtle" onClick={() => saveEdit(m.id)}>
                              Save
                            </Button>
                          </div>
                        ) : (
                          <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
                        )}
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 2 }}>
                          {new Date(m.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {m.isEdited && ' · edited'}
                          {mine && m.status === 'read' && ' · read'}
                        </div>
                        {mine && editing !== m.id && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                            <button
                              className="linkish"
                              onClick={() => {
                                setEditing(m.id);
                                setEditText(m.content);
                              }}
                            >
                              Edit
                            </button>
                            {canRecall && (
                              <button className="linkish" onClick={() => recall(m.id)}>
                                Recall
                              </button>
                            )}
                            <button className="linkish" onClick={() => remove(m.id)}>
                              Delete
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="row-actions">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  if (f) void uploadImage(f);
                }}
              />
              <Button variant="ghost" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? 'Uploading…' : 'Image'}
              </Button>
              <Input
                label=""
                value={draft}
                onChange={(e) => setDraft(e.currentTarget.value)}
                placeholder="Type a message…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <Button disabled={busy || !draft.trim()} onClick={send}>
                Send
              </Button>
            </div>
          </Card>
        </div>
      </ApiState>
    </div>
  );
}
