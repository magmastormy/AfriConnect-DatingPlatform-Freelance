import { Request, Response } from 'express';
import { IMockChatService } from './mockchat.service';
import { asyncHandler, success, NotFoundError } from '@africonnect/shared';
import { z } from 'zod';

// Validation schemas
const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000).optional(),
  imageUrl: z.string().url().optional(),
}).refine(data => data.content || data.imageUrl, {
  message: 'Either content or imageUrl is required',
});

const createConversationSchema = z.object({
  personaId: z.string().uuid(),
});

const listConversationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const getMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().uuid().optional(), // message ID to paginate before
});

export class MockChatController {
  constructor(private readonly service: IMockChatService) {}

  /**
   * GET /mockchat/conversations
   * List all mock conversations for the current user
   */
  listConversations = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { limit, offset } = listConversationsQuerySchema.parse(req.query);
    
    const conversations = await this.service.listMockConversations(userId);
    
    // Apply pagination
    const paginated = conversations.slice(offset, offset + limit);
    
    res.status(200).json(success({
      conversations: paginated,
      meta: {
        total: conversations.length,
        limit,
        offset,
        hasMore: offset + limit < conversations.length,
      },
    }));
  });

  /**
   * POST /mockchat/conversations
   * Create or get a conversation with a specific persona
   */
  createConversation = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { personaId } = createConversationSchema.parse(req.body);
    
    const conversation = await this.service.getOrCreateMockConversation(userId, personaId);
    
    res.status(201).json(success(conversation));
  });

  /**
   * GET /mockchat/conversations/:id
   * Get messages for a mock conversation
   */
  getMessages = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { limit, before } = getMessagesQuerySchema.parse(req.query);
    
    let messages = await this.service.getMockMessages(userId, id);
    
    // Apply pagination (before = message ID to paginate before)
    if (before) {
      const beforeIndex = messages.findIndex(m => m.id === before);
      if (beforeIndex > 0) {
        messages = messages.slice(Math.max(0, beforeIndex - limit), beforeIndex);
      } else {
        messages = [];
      }
    } else {
      // Get most recent messages
      messages = messages.slice(-limit);
    }
    
    res.status(200).json(success({
      messages,
      meta: {
        limit,
        hasMore: messages.length === limit,
      },
    }));
  });

  /**
   * POST /mockchat/conversations/:id
   * Send a message to a mock user (persona)
   */
  sendMessage = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;
    const body = sendMessageSchema.parse(req.body);
    
    // Verify conversation exists and belongs to user
    await this.service.getMockMessages(userId, id);
    // If we got here, conversation exists and user is participant
    
    // Get persona ID from conversation
    const conversations = await this.service.listMockConversations(userId);
    const conversationMeta = conversations.find(c => c.id === id);
    
    if (!conversationMeta) {
      throw new NotFoundError('Conversation not found', { conversationId: id });
    }
    
    const message = await this.service.sendToMockUser(userId, conversationMeta.personaId, {
      userId,
      personaId: conversationMeta.personaId,
      content: body.content || '',
      imageUrl: body.imageUrl,
    });
    
    res.status(201).json(success(message));
  });

  /**
   * POST /mockchat/conversations/:id/read
   * Mark a mock conversation as read
   */
  markRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    await this.service.markMockConversationRead(userId, id);
    
    res.status(200).json(success({ marked: true }));
  });

  /**
   * GET /mockchat/personas
   * List all available personas
   */
  listPersonas = asyncHandler(async (_req: Request, res: Response) => {
    const personas = this.service.getAvailablePersonas();
    
    // Return safe public info (no system prompts)
    const publicPersonas = personas.map(p => ({
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      background: {
        age: p.background.age,
        city: p.background.city,
        profession: p.background.profession,
        bio: p.background.bio,
      },
      interests: p.interests.primary,
      communicationStyle: {
        tone: p.communicationStyle.tone,
        responseLength: p.communicationStyle.responseLength,
      },
    }));
    
    res.status(200).json(success({ personas: publicPersonas }));
  });

  /**
   * GET /mockchat/personas/:id
   * Get detailed persona info (for profile view)
   */
  getPersona = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const persona = this.service.getPersona(id);
    
    if (!persona) {
      throw new NotFoundError('Persona not found', { personaId: id });
    }
    
    // Return public info only
    const publicPersona = {
      id: persona.id,
      name: persona.name,
      displayName: persona.displayName,
      avatarUrl: persona.avatarUrl,
      background: {
        age: persona.background.age,
        gender: persona.background.gender,
        city: persona.background.city,
        profession: persona.background.profession,
        educationLevel: persona.background.educationLevel,
        nationality: persona.background.nationality,
        relationshipGoals: persona.background.relationshipGoals,
        bio: persona.background.bio,
      },
      interests: persona.interests,
      communicationStyle: persona.communicationStyle,
      behavioralTraits: persona.behavioralTraits,
    };
    
    res.status(200).json(success(publicPersona));
  });

  /**
   * GET /mockchat/config
   * Get current mock chat configuration (admin only)
   */
  getConfig = asyncHandler(async (_req: Request, res: Response) => {
    const config = this.service.getConfig();
    // Don't expose API keys
    const safeConfig = {
      enabled: config.enabled,
      llm: {
        provider: config.llm.provider,
        model: config.llm.openai?.model || config.llm.anthropic?.model || config.llm.local?.model || config.llm.mock?.model,
      },
      autoRespond: config.autoRespond,
      responseDelayMs: config.responseDelayMs,
      maxConcurrentConversations: config.maxConcurrentConversations,
      rateLimitPerUserPerMinute: config.rateLimitPerUserPerMinute,
    };
    
    res.status(200).json(success(safeConfig));
  });
}