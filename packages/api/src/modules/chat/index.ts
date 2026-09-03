import { Router } from 'express';
import { ChatService, IChatService } from './chat.service';
import { ChatRepository } from './chat.repository';
import { ChatController } from './chat.controller';
import { chatRoutes } from './chat.routes';
import { RealtimeHub } from './chat.ws';
import { prisma } from '@config/prisma';
import { config } from '@config/index';
import { createMediaStorage } from '@config/providers';
import { createLLMProvider, ILLMProvider } from '../../lib/llm';
import type { IMatchService } from '@modules/match';

let realtime: RealtimeHub | undefined;

// The realtime hub is bound to the HTTP server in server.ts (after listen), then
// registered here so chat.send/edit/delete can push live events to both peers.
export function setRealtimeHub(hub: RealtimeHub): void {
  realtime = hub;
}

/**
 * Builds the AI provider used to auto-reply in the other participant's voice.
 *
 * Prefers Groq (openai/gpt-oss-120b) when GROQ_API_KEY is set; otherwise falls
 * back to the built-in mock so messaging still "works" in a key-less local
 * environment. Returns null only when the flag is off (no AI replies at all).
 */
function buildAiProvider(): ILLMProvider | null {
  if (!config.aiChatEnabled) return null;
  const key = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  if (key) {
    return createLLMProvider({
      provider: 'groq',
      groq: { apiKey: key, model, timeoutMs: 30000 },
    });
  }
  // No key configured — serve canned, offline-friendly replies.
  return createLLMProvider({ provider: 'mock' });
}

export function buildChatModule(matchService?: IMatchService): Router {
  const repo = new ChatRepository(prisma);
  const aiProvider = buildAiProvider();
  const media = createMediaStorage();
  const service: IChatService = new ChatService(repo, realtime, matchService, media, {
    llm: aiProvider ?? undefined,
    aiChatEnabled: config.aiChatEnabled,
  });
  const controller = new ChatController(service, media);
  return chatRoutes(controller, service);
}

export { ChatService, ChatRepository, ChatController, RealtimeHub };
export * from './chat.types';
export * from './chat.schema';
