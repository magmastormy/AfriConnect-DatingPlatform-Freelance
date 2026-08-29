import { z } from 'zod';

/**
 * Mock Chat Schemas
 * 
 * Zod validation schemas for mock chat API endpoints.
 */

// Persona schemas
export const personaToneSchema = z.enum([
  'friendly', 'witty', 'thoughtful', 'playful', 
  'professional', 'casual', 'warm', 'confident', 'shy', 'energetic'
]);

export const personaLanguageSchema = z.enum([
  'en', 'af', 'zu', 'xh', 'st', 'ts', 'tn', 'ss', 've', 'nr'
]);

export const personaInterestsSchema = z.object({
  primary: z.array(z.string().min(1).max(50)).min(1).max(10),
  secondary: z.array(z.string().min(1).max(50)).max(10).default([]),
  conversationStarters: z.array(z.string().min(1).max(200)).max(10).default([]),
});

export const personaBackgroundSchema = z.object({
  age: z.number().int().min(18).max(80),
  gender: z.enum(['male', 'female', 'non_binary', 'other']),
  city: z.string().min(1).max(100),
  profession: z.string().min(1).max(100),
  educationLevel: z.string().min(1).max(50),
  nationality: z.string().min(1).max(50),
  relationshipGoals: z.string().min(1).max(100),
  bio: z.string().max(500),
});

export const personaCommunicationStyleSchema = z.object({
  tone: personaToneSchema,
  language: personaLanguageSchema.default('en'),
  responseLength: z.enum(['short', 'medium', 'long']).default('medium'),
  useEmojis: z.boolean().default(true),
  useSlang: z.boolean().default(false),
  formalityLevel: z.number().int().min(1).max(10).default(3),
  responseDelayMs: z.object({
    min: z.number().int().min(0).default(500),
    max: z.number().int().min(0).default(2000),
  }).default({ min: 500, max: 2000 }),
});

export const personaBehavioralTraitsSchema = z.object({
  curiosityLevel: z.number().int().min(1).max(10).default(5),
  opennessLevel: z.number().int().min(1).max(10).default(5),
  humorLevel: z.number().int().min(1).max(10).default(5),
  empathyLevel: z.number().int().min(1).max(10).default(5),
  initiativeLevel: z.number().int().min(1).max(10).default(5),
  conflictAvoidance: z.number().int().min(1).max(10).default(5),
});

export const mockPersonaConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  displayName: z.string().min(1).max(50),
  avatarUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
  background: personaBackgroundSchema,
  interests: personaInterestsSchema,
  communicationStyle: personaCommunicationStyleSchema,
  behavioralTraits: personaBehavioralTraitsSchema,
  systemPrompt: z.string().min(50).max(3000),
  llmConfig: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(50).max(2000).optional(),
    model: z.string().optional(),
  }).optional(),
});

// API request schemas
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

// Admin schemas (for persona management)
export const createPersonaSchema = mockPersonaConfigSchema.omit({ id: true, systemPrompt: true });
export const updatePersonaSchema = createPersonaSchema.partial();

// Type exports
export type PersonaTone = z.infer<typeof personaToneSchema>;
export type PersonaLanguage = z.infer<typeof personaLanguageSchema>;
export type PersonaInterests = z.infer<typeof personaInterestsSchema>;
export type PersonaBackground = z.infer<typeof personaBackgroundSchema>;
export type PersonaCommunicationStyle = z.infer<typeof personaCommunicationStyleSchema>;
export type PersonaBehavioralTraits = z.infer<typeof personaBehavioralTraitsSchema>;
export type MockPersonaConfig = z.infer<typeof mockPersonaConfigSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;
export type GetMessagesQuery = z.infer<typeof getMessagesQuerySchema>;
export type CreatePersonaInput = z.infer<typeof createPersonaSchema>;
export type UpdatePersonaInput = z.infer<typeof updatePersonaSchema>;