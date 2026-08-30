import { Router } from 'express';
import { MockChatService } from './mockchat.service';
import type { MockChatConfig } from './mockchat.service';
import { MockChatController } from './mockchat.controller';
import { mockChatRoutes } from './mockchat.routes';
import { personaRegistry } from './persona.registry';
import { conversationContextManager } from './conversation.context';
import { RealtimeHub } from '../chat/chat.ws';
import { logger } from '@africonnect/shared';
import type { LLMProviderType } from './llm.provider';

let mockChatService: MockChatService | undefined;
let mockChatController: MockChatController | undefined;

/**
 * Build the mock chat module router
 */
export function buildMockChatModule(realtime?: RealtimeHub): Router {
  // Build config from environment
  const mockChatConfig: MockChatConfig = {
    enabled: process.env.MOCK_CHAT_ENABLED === 'true',
    llm: {
      provider: (process.env.MOCK_CHAT_LLM_PROVIDER as LLMProviderType) || 'mock',
      openai: process.env.OPENAI_API_KEY ? {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        baseUrl: process.env.OPENAI_BASE_URL,
      } : undefined,
      anthropic: process.env.ANTHROPIC_API_KEY ? {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
      } : undefined,
      groq: process.env.GROQ_API_KEY ? {
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
      } : undefined,
      local: process.env.LOCAL_LLM_URL ? {
        model: process.env.LOCAL_LLM_MODEL || 'llama3.1:8b',
        baseUrl: process.env.LOCAL_LLM_URL,
      } : undefined,
      mock: {
        model: 'mock-model',
      },
    },
    defaultPersonaId: process.env.MOCK_CHAT_DEFAULT_PERSONA_ID,
    autoRespond: process.env.MOCK_CHAT_AUTO_RESPOND !== 'false',
    responseDelayMs: {
      min: Number(process.env.MOCK_CHAT_RESPONSE_DELAY_MIN) || 500,
      max: Number(process.env.MOCK_CHAT_RESPONSE_DELAY_MAX) || 2000,
    },
    maxConcurrentConversations: Number(process.env.MOCK_CHAT_MAX_CONCURRENT) || 100,
    rateLimitPerUserPerMinute: Number(process.env.MOCK_CHAT_RATE_LIMIT) || 30,
  };

  // Initialize persona registry
  personaRegistry.initialize();

  // Create service and controller
  mockChatService = new MockChatService(mockChatConfig, realtime);
  mockChatController = new MockChatController(mockChatService);

  // Set realtime hub on service for broadcasting
  if (realtime) {
    mockChatService.setRealtimeHub(realtime);
  }

  // `llmConfigured` is carried here too, not just in MockChatService's own log:
  // when the provider is unusable the persona chat silently serves canned
  // replies, so this line is the first thing to check in a Render log.
  logger.info({ 
    enabled: mockChatConfig.enabled,
    llmProvider: mockChatConfig.llm.provider,
    llmConfigured: mockChatService.isLlmAvailable(),
    personas: personaRegistry.getActiveCount(),
  }, 'MockChat module initialized');

  return mockChatRoutes(mockChatController, mockChatService);
}

/**
 * Set the realtime hub (called from server.ts after HTTP server starts)
 */
export function setMockChatRealtimeHub(hub: RealtimeHub): void {
  if (mockChatService) {
    mockChatService.setRealtimeHub(hub);
  }
}

/**
 * Get the mock chat service instance (for testing or admin operations)
 */
export function getMockChatService(): MockChatService | undefined {
  return mockChatService;
}

/**
 * Get the conversation context manager (for testing or admin operations)
 */
export function getConversationContextManager() {
  return conversationContextManager;
}

/**
 * Get the persona registry (for testing or admin operations)
 */
export function getPersonaRegistry() {
  return personaRegistry;
}

// Export types and classes
export { MockChatService } from './mockchat.service';
export type { MockChatConfig } from './mockchat.service';
export { MockChatController } from './mockchat.controller';
export { personaRegistry } from './persona.registry';
export { conversationContextManager } from './conversation.context';
export { 
  createLLMProvider,
  OpenAIProvider,
  AnthropicProvider,
  GroqProvider,
  LocalLLMProvider,
  MockLLMProvider,
  MultiLLMProvider,
} from './llm.provider';
export type { 
  ILLMProvider, 
  LLMMessage, 
  LLMResponse, 
  LLMProviderConfig,
  LLMProviderType,
  LLMProviderFactoryConfig,
} from './llm.provider';
export type { 
  MockPersonaConfig, 
  PersonaBackground, 
  PersonaCommunicationStyle, 
  PersonaBehavioralTraits, 
  PersonaInterests 
} from './persona.types';
export type { ConversationContext, ConversationMessage } from './conversation.context';