import { Server as WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { verifyAccessToken } from '@config/jwt';
import { prisma } from '@config/prisma';
import { logger } from '@africonnect/shared';
import { redisEnabled, redisPublish, redisSubscribe } from '@config/redis';

const CHANNEL = 'chat';
const HEARTBEAT_MS = 30_000;

// Local sockets connected to THIS instance — used to target deliveries.
const localPresence = new Map<string, Set<WebSocket>>();
// Best-effort global "who is online" view, maintained from presence events.
const onlineUsers = new Set<string>();

export type ChatEvent =
  | { type: 'message'; conversationId: string; message: unknown }
  | { type: 'read'; conversationId: string; by: string }
  | { type: 'presence'; userId: string; online: boolean }
  | { type: 'pong' };

function send(ws: WebSocket, event: ChatEvent): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(event));
}

/** Deliver an event to the locally-connected sockets of a conversation's participants. */
async function deliverLocal(conversationId: string, message: unknown): Promise<void> {
  try {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { participant1Id: true, participant2Id: true },
    });
    if (!conv) return;
    const event: ChatEvent = { type: 'message', conversationId, message };
    for (const uid of [conv.participant1Id, conv.participant2Id]) {
      const set = localPresence.get(uid);
      if (!set) continue;
      for (const ws of set) send(ws, event);
    }
  } catch (err) {
    logger.error({ err, conversationId }, 'RealtimeHub: deliver failed');
  }
}

function markOnline(userId: string, online: boolean): void {
  if (online) onlineUsers.add(userId);
  else onlineUsers.delete(userId);
}

// Single cross-instance subscription. Every instance publishes to CHANNEL and
// receives every message; it then delivers only to sockets connected locally.
// Without Redis (redisEnabled=false) this degrades to an in-process EventEmitter,
// which is correct for a single instance.
let subscribed = false;
function ensureSubscribed(): void {
  if (subscribed) return;
  subscribed = true;
  redisSubscribe(CHANNEL, (raw: string) => {
    try {
      const msg = JSON.parse(raw) as ChatEvent;
      if (msg.type === 'message') void deliverLocal(msg.conversationId, msg.message);
      else if (msg.type === 'presence') markOnline(msg.userId, msg.online);
    } catch {
      /* ignore malformed frames */
    }
  });
}

export class RealtimeHub {
  private wss: WebSocketServer;
  private timer: NodeJS.Timeout;

  constructor(server: import('http').Server) {
    this.wss = new WebSocketServer({ noServer: true });
    server.on('upgrade', (req, socket, head) => this.handleUpgrade(req, socket, head));
    this.timer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    this.timer.unref();
    if (redisEnabled) ensureSubscribed();
  }

  private handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.endsWith('/ws')) return; // let other upgrade paths pass
    const token = url.searchParams.get('token');
    if (!token) {
      socket.destroy();
      return;
    }
    let userId: string;
    try {
      const payload = verifyAccessToken(token);
      userId = payload.sub;
    } catch {
      socket.destroy();
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.register(userId, ws);
      ws.on('message', (raw) => this.onMessage(userId, ws, raw.toString()));
      ws.on('close', () => this.unregister(userId, ws));
      ws.on('error', () => this.unregister(userId, ws));
      send(ws, { type: 'presence', userId, online: true });
      this.publishPresence(userId, true);
    });
  }

  private register(userId: string, ws: WebSocket) {
    const set = localPresence.get(userId) ?? new Set<WebSocket>();
    set.add(ws);
    localPresence.set(userId, set);
    markOnline(userId, true);
  }

  private unregister(userId: string, ws: WebSocket) {
    const set = localPresence.get(userId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) {
      localPresence.delete(userId);
      this.publishPresence(userId, false);
    }
  }

  private publishPresence(userId: string, online: boolean): void {
    redisPublish(CHANNEL, JSON.stringify({ type: 'presence', userId, online } as ChatEvent));
    // Also reflect locally immediately so isOnline() is consistent on this instance.
    markOnline(userId, online && (localPresence.get(userId)?.size ?? 0) > 0);
  }

  private onMessage(userId: string, ws: WebSocket, raw: string) {
    try {
      const msg = JSON.parse(raw);
      if (msg?.type === 'ping') send(ws, { type: 'pong' });
    } catch {
      /* ignore malformed frames */
    }
    void userId;
  }

  private heartbeat() {
    for (const set of localPresence.values()) {
      for (const ws of set) {
        if (ws.readyState === ws.OPEN) {
          try {
            ws.ping();
          } catch {
            /* noop */
          }
        }
      }
    }
  }

  /** Notify both participants of a conversation about a new message (cross-instance). */
  async broadcastMessage(conversationId: string, message: unknown): Promise<void> {
    // Publish to the shared channel; every instance (including this one) receives
    // it and delivers to its locally-connected sockets via deliverLocal. This is
    // what makes chat work when the two participants are on different instances.
    redisPublish(CHANNEL, JSON.stringify({ type: 'message', conversationId, message } as ChatEvent));
  }

  isOnline(userId: string): boolean {
    return onlineUsers.has(userId);
  }
}
