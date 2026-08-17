'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getAccessToken } from './api';

type ChatEvent =
  | { type: 'message'; conversationId: string; message: unknown }
  | { type: 'read'; conversationId: string; by: string }
  | { type: 'presence'; userId: string; online: boolean }
  | { type: 'pong' };

interface Options {
  conversationId?: string;
  onMessage?: (conversationId: string, message: unknown) => void;
  onPresence?: (userId: string, online: boolean) => void;
}

// Lightweight WebSocket client for live chat. Falls back silently to REST polling
// if the socket can't connect; the messages page still works via its fetch path.
export function useChatSocket({ conversationId, onMessage, onPresence }: Options) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const cbRef = useRef({ onMessage, onPresence });
  cbRef.current = { onMessage, onPresence };

  // Reconnect key. Named distinctly from the API `mount` segment resolved inside
  // the effect below, which previously shadowed this and made the dependency
  // array read as if it tracked the mount path rather than the conversation.
  const conversationKey = conversationId;

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const proto =
      typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
    const mount = (process.env.NEXT_PUBLIC_API_MOUNT || 'api').replace(/^\/+|\/+$/g, '');
    const host =
      (process.env.NEXT_PUBLIC_API_WS || '').replace(/^wss?:\/\//, '') ||
      (typeof window !== 'undefined' ? window.location.host : 'localhost:4000');
    const ws = new WebSocket(
      `${proto}://${host}/${mount}/v1/ws?token=${encodeURIComponent(token)}`,
    );
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => {
      /* ignore; REST fallback covers this */
    };
    ws.onmessage = (ev) => {
      try {
        const event = JSON.parse(ev.data) as ChatEvent;
        if (event.type === 'message' && cbRef.current.onMessage) {
          cbRef.current.onMessage(event.conversationId, event.message);
        } else if (event.type === 'presence' && cbRef.current.onPresence) {
          cbRef.current.onPresence(event.userId, event.online);
        }
      } catch {
        /* ignore malformed frames */
      }
    };
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    }, 25000);
    return () => {
      clearInterval(heartbeat);
      ws.close();
      wsRef.current = null;
    };
  }, [conversationKey]);

  const sendRaw = useCallback((payload: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
  }, []);

  return { connected, sendRaw };
}
