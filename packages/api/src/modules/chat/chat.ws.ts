import { Server as WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { verifyAccessToken } from '@config/jwt';
import { prisma } from '@config/prisma';
import { logger } from '@africonnect/shared';

// In-memory presence map: userId -> set of live sockets. Reset on restart is
// acceptable for a v1 realtime layer; a scaled deployment would use Redis pub/sub.
const presence = new Map<string, Set<WebSocket>>();
const HEARTBEAT_MS = 30_000;

export type ChatEvent =
  | { type: 'message'; conversationId: string; message: unknown }
  | { type: 'read'; conversationId: string; by: string }
  | { type: 'presence'; userId: string; online: boolean }
  | { type: 'pong' };

export class RealtimeHub {
  private wss: WebSocketServer;
  private timer: NodeJS.Timeout;

  constructor(server: import('http').Server) {
    this.wss = new WebSocketServer({ noServer: true });
    server.on('upgrade', (req, socket, head) => this.handleUpgrade(req, socket, head));
    this.timer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    this.timer.unref();
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
      this.send(ws, { type: 'presence', userId, online: true });
      this.broadcastPresence(userId, true);
    });
  }

  private register(userId: string, ws: WebSocket) {
    const set = presence.get(userId) ?? new Set<WebSocket>();
    set.add(ws);
    presence.set(userId, set);
  }

  private unregister(userId: string, ws: WebSocket) {
    const set = presence.get(userId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) {
      presence.delete(userId);
      this.broadcastPresence(userId, false);
    }
  }

  private onMessage(userId: string, ws: WebSocket, raw: string) {
    // Client may send a ping frame; echo pong to keep the connection alive.
    try {
      const msg = JSON.parse(raw);
      if (msg?.type === 'ping') this.send(ws, { type: 'pong' });
    } catch {
      /* ignore malformed frames */
    }
    void userId;
  }

  private heartbeat() {
    for (const set of presence.values()) {
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

  private send(ws: WebSocket, event: ChatEvent) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(event));
  }

  private broadcastPresence(userId: string, online: boolean) {
    const event: ChatEvent = { type: 'presence', userId, online };
    for (const [uid, set] of presence) {
      if (uid === userId) continue;
      for (const ws of set) this.send(ws, event);
    }
  }

  /** Notify both participants of a conversation about a new message. */
  async broadcastMessage(conversationId: string, message: unknown): Promise<void> {
    try {
      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { participant1Id: true, participant2Id: true },
      });
      if (!conv) return;
      const event: ChatEvent = { type: 'message', conversationId, message };
      for (const uid of [conv.participant1Id, conv.participant2Id]) {
        const set = presence.get(uid);
        if (!set) continue;
        for (const ws of set) this.send(ws, event);
      }
    } catch (err) {
      logger.error({ err, conversationId }, 'RealtimeHub: broadcast failed');
    }
  }

  isOnline(userId: string): boolean {
    return (presence.get(userId)?.size ?? 0) > 0;
  }
}
