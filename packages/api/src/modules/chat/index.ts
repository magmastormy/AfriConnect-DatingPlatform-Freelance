import { Router } from 'express';
import { ChatService, IChatService } from './chat.service';
import { ChatRepository } from './chat.repository';
import { ChatController } from './chat.controller';
import { chatRoutes } from './chat.routes';
import { RealtimeHub } from './chat.ws';
import { prisma } from '@config/prisma';
import { createMediaStorage } from '@config/providers';
import type { IMatchService } from '@modules/match';

let realtime: RealtimeHub | undefined;

// The realtime hub is bound to the HTTP server in server.ts (after listen), then
// registered here so chat.send/edit/delete can push live events to both peers.
export function setRealtimeHub(hub: RealtimeHub): void {
  realtime = hub;
}

export function buildChatModule(matchService?: IMatchService): Router {
  const repo = new ChatRepository(prisma);
  const service: IChatService = new ChatService(repo, realtime, matchService);
  const media = createMediaStorage();
  const controller = new ChatController(service, media);
  return chatRoutes(controller, service);
}

export { ChatService, ChatRepository, ChatController, RealtimeHub };
export * from './chat.types';
export * from './chat.schema';
