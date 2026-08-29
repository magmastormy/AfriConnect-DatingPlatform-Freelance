import { z } from 'zod';

/**
 * Mock Chat Types
 * 
 * Shared types for the mock chat module.
 */

export interface SendMessageToMockUserInput {
  userId: string;
  personaId: string;
  content: string;
  imageUrl?: string;
}

export interface MockConversation {
  id: string;
  userId: string;
  personaId: string;
  personaName: string;
  personaDisplayName: string;
  personaAvatarUrl?: string;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  isActive: boolean;
  createdAt: Date;
}

export interface MockMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'user' | 'persona';
  content: string;
  imageUrl?: string | null;
  status: 'sent' | 'delivered' | 'read';
  isEdited: boolean;
  editedAt?: Date | null;
  isDeleted: boolean;
  deletedAt?: Date | null;
  recalledAt?: Date | null;
  createdAt: Date;
}

export interface MockChatConfig {
  enabled: boolean;
  llm: LLMProviderFactoryConfig;
  defaultPersonaId?: string;
  autoRespond: boolean;
  responseDelayMs: { min: number; max: number };
  maxConcurrentConversations: number;
  rateLimitPerUserPerMinute: number;
}

export interface LLMProviderFactoryConfig {
  provider: LLMProviderType;
  openai?: LLMProviderConfig;
  anthropic?: LLMProviderConfig;
  groq?: LLMProviderConfig;
  local?: LLMProviderConfig;
  mock?: LLMProviderConfig;
}

export type LLMProviderType = 'openai' | 'anthropic' | 'groq' | 'local' | 'mock';

export interface LLMProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  timeoutMs?: number;
}

// Validation schemas
export const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000).optional(),
  imageUrl: z.string().url().optional(),
}).refine(data => data.content || data.imageUrl, {
  message: 'Either content or imageUrl is required',
});

export const createConversationSchema = z.object({
  personaId: z.string().uuid(),
});

export const listConversationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const getMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().uuid().optional(),
});