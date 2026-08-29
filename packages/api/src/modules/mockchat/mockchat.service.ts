import { logger } from '@africonnect/shared';
import { ValidationError, NotFoundError, InternalError } from '@africonnect/shared';
import { rawPrisma, RLS_ENABLED } from '@config/prisma';
import { 
  ILLMProvider, 
  LLMResponse,
  createLLMProvider,
  LLMProviderFactoryConfig 
} from './llm.provider';
import { personaRegistry } from './persona.registry';
import { conversationContextManager } from './conversation.context';
import { MockPersonaConfig } from './persona.types';
import { RealtimeHub } from '../chat/chat.ws';

export interface MockChatConfig {
  enabled: boolean;
  llm: LLMProviderFactoryConfig;
  defaultPersonaId?: string;
  autoRespond: boolean;
  responseDelayMs: { min: number; max: number };
  maxConcurrentConversations: number;
  rateLimitPerUserPerMinute: number;
}

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
  senderId: string; // userId or personaId
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

export interface IMockChatService {
  // Conversation management
  getOrCreateMockConversation(userId: string, personaId: string): Promise<MockConversation>;
  listMockConversations(userId: string): Promise<MockConversation[]>;
  getMockMessages(userId: string, conversationId: string): Promise<MockMessage[]>;
  
  // Messaging
  sendToMockUser(userId: string, personaId: string, input: SendMessageToMockUserInput): Promise<MockMessage>;
  markMockConversationRead(userId: string, conversationId: string): Promise<void>;
  
  // Persona management
  getAvailablePersonas(): MockPersonaConfig[];
  getPersona(personaId: string): MockPersonaConfig | undefined;
  
  // Configuration
  updateConfig(config: Partial<MockChatConfig>): void;
  getConfig(): MockChatConfig;
}

export class MockChatService implements IMockChatService {
  private config: MockChatConfig;
  private llmProvider: ILLMProvider;
  private realtime?: RealtimeHub;
  private userRateLimits: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(
    config: MockChatConfig,
    realtime?: RealtimeHub
  ) {
    this.config = config;
    this.realtime = realtime;
    this.llmProvider = createLLMProvider(config.llm);
    
    logger.info({ 
      provider: this.llmProvider.name, 
      model: this.llmProvider.defaultModel,
      enabled: config.enabled 
    }, 'MockChatService initialized');
  }

  /**
   * Get or create a mock conversation between a user and a persona
   */
  async getOrCreateMockConversation(userId: string, personaId: string): Promise<MockConversation> {
    if (!this.config.enabled) {
      throw new ValidationError('Mock chat is not enabled');
    }

    const persona = personaRegistry.getPersona(personaId);
    if (!persona) {
      throw new NotFoundError('Persona not found', { personaId });
    }
    if (!persona.isActive) {
      throw new ValidationError('This persona is not currently available');
    }

    // Check if conversation exists in database
    const existing = await this.findMockConversation(userId, personaId);
    if (existing) {
      return existing;
    }

    // Create new conversation
    return this.createMockConversation(userId, persona);
  }

  /**
   * List all mock conversations for a user
   */
  async listMockConversations(userId: string): Promise<MockConversation[]> {
    if (!this.config.enabled) {
      throw new ValidationError('Mock chat is not enabled');
    }

    const conversations = await this.findUserMockConversations(userId);
    return conversations;
  }

  /**
   * Get messages for a mock conversation
   */
  async getMockMessages(userId: string, conversationId: string): Promise<MockMessage[]> {
    if (!this.config.enabled) {
      throw new ValidationError('Mock chat is not enabled');
    }

    const conversation = await this.findMockConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found', { conversationId });
    }
    if (conversation.userId !== userId) {
      throw new ValidationError('You are not a participant in this conversation');
    }

    return this.getConversationMessages(conversationId);
  }

  /**
   * Send a message to a mock user (persona) and get AI response
   */
  async sendToMockUser(
    userId: string, 
    personaId: string, 
    input: SendMessageToMockUserInput
  ): Promise<MockMessage> {
    if (!this.config.enabled) {
      throw new ValidationError('Mock chat is not enabled');
    }

    // Rate limiting
    if (!this.checkRateLimit(userId)) {
      throw new ValidationError('Rate limit exceeded. Please slow down.');
    }

    const persona = personaRegistry.getPersona(personaId);
    if (!persona) {
      throw new NotFoundError('Persona not found', { personaId });
    }
    if (!persona.isActive) {
      throw new ValidationError('This persona is not currently available');
    }

    // Get or create conversation
    let conversation = await this.findMockConversation(userId, personaId);
    if (!conversation) {
      conversation = await this.createMockConversation(userId, persona);
    }

    // Save user message
    const userMessage = await this.saveMessage({
      conversationId: conversation.id,
      senderId: userId,
      senderType: 'user',
      content: input.content,
      imageUrl: input.imageUrl,
    });

    // Update conversation last message
    await this.updateConversationLastMessage(conversation.id, userMessage);

    // Broadcast user message via WebSocket
    await this.broadcastMessage(conversation.id, userMessage);

    // Extract memory from user message
    conversationContextManager.extractMemoryFromMessage(conversation.id, input.content);

    // Generate persona response if auto-respond is enabled
    if (this.config.autoRespond) {
      // Simulate typing delay
      const delay = this.getResponseDelay(persona);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Generate AI response
      const personaResponse = await this.generatePersonaResponse(
        conversation.id,
        persona,
        input.content
      );

      // Save persona message
      const personaMessage = await this.saveMessage({
        conversationId: conversation.id,
        senderId: personaId,
        senderType: 'persona',
        content: personaResponse.content,
      });

      // Update conversation last message
      await this.updateConversationLastMessage(conversation.id, personaMessage);

      // Broadcast persona message via WebSocket
      await this.broadcastMessage(conversation.id, personaMessage);

      return personaMessage;
    }

    return userMessage;
  }

  /**
   * Generate a persona response using the LLM
   */
  private async generatePersonaResponse(
    conversationId: string,
    persona: MockPersonaConfig,
    userMessage: string
  ): Promise<LLMResponse> {
    // Get or create conversation context
    conversationContextManager.getOrCreateContext(
      conversationId,
      persona.id,
      '', // userId not needed here
      persona
    );

    // Build messages for LLM
    const messages = conversationContextManager.buildLLMMessages(
      conversationId,
      persona,
      persona.systemPrompt
    );

    // Add the current user message
    messages.push({ role: 'user', content: userMessage });

    // Prepare LLM config with persona overrides
    const llmConfig = {
      model: persona.llmConfig?.model,
      temperature: persona.llmConfig?.temperature,
      maxTokens: persona.llmConfig?.maxTokens,
    };

    try {
      const response = await this.llmProvider.complete(messages, llmConfig);
      
      // Add to context
      conversationContextManager.addPersonaMessage(
        conversationId,
        crypto.randomUUID(),
        response.content,
        response.usage?.completionTokens
      );

      // Update memory based on response
      this.updateMemoryFromResponse(conversationId, response.content);

      return response;
    } catch (error) {
      logger.error({ 
        error, 
        conversationId, 
        personaId: persona.id 
      }, 'Failed to generate persona response');
      
      // Fallback response
      return {
        content: this.getFallbackResponse(persona),
        model: this.llmProvider.defaultModel,
      };
    }
  }

  /**
   * Get fallback response when LLM fails
   */
  private getFallbackResponse(persona: MockPersonaConfig): string {
    const fallbacks: Record<string, string[]> = {
      friendly: [
        "That's interesting! Tell me more.",
        "I'd love to hear more about that.",
        "What made you think of that?",
      ],
      witty: [
        "Well, that's a plot twist I didn't see coming! 😄",
        "You've got me curious now...",
        "Hmm, let me think about that one.",
      ],
      thoughtful: [
        "That gives me something to think about.",
        "I appreciate you sharing that.",
        "It's not often someone asks me that.",
      ],
      warm: [
        "That sounds really meaningful.",
        "Thank you for opening up about that.",
        "I can hear how much that matters to you.",
      ],
    };

    const toneFallbacks = fallbacks[persona.communicationStyle.tone] || fallbacks.friendly;
    return toneFallbacks[Math.floor(Math.random() * toneFallbacks.length)];
  }

  /**
   * Update memory from persona response
   */
  private updateMemoryFromResponse(conversationId: string, response: string): void {
    // Simple extraction - in production could be more sophisticated
    const context = conversationContextManager.getContext(conversationId);
    if (!context) return;

    // Track that we discussed something new
    const lower = response.toLowerCase();
    const newTopics: string[] = [];
    
    if (lower.includes('i think') || lower.includes('i feel') || lower.includes('my opinion')) {
      newTopics.push('personal_opinion');
    }
    if (lower.includes('when i was') || lower.includes('growing up') || lower.includes('childhood')) {
      newTopics.push('personal_history');
    }
    if (lower.includes('i love') || lower.includes('i enjoy') || lower.includes('my favorite')) {
      newTopics.push('personal_preference');
    }

    if (newTopics.length > 0) {
      conversationContextManager.updateMemory(conversationId, {
        topicsDiscussed: newTopics,
      });
    }
  }

  /**
   * Mark mock conversation as read
   */
  async markMockConversationRead(userId: string, conversationId: string): Promise<void> {
    const conversation = await this.findMockConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found', { conversationId });
    }
    if (conversation.userId !== userId) {
      throw new ValidationError('You are not a participant in this conversation');
    }

    // In a full implementation, we'd update unread counts in DB
    // For now, just acknowledge
    logger.debug({ userId, conversationId }, 'Mock conversation marked as read');
  }

  /**
   * Get all available personas
   */
  getAvailablePersonas(): MockPersonaConfig[] {
    return personaRegistry.getActivePersonas();
  }

  /**
   * Get a specific persona
   */
  getPersona(personaId: string): MockPersonaConfig | undefined {
    return personaRegistry.getPersona(personaId);
  }

  /**
   * Update service configuration
   */
  updateConfig(config: Partial<MockChatConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info({ config: this.config }, 'MockChatService config updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): MockChatConfig {
    return { ...this.config };
  }

  /**
   * Set realtime hub for WebSocket broadcasting
   */
  setRealtimeHub(hub: RealtimeHub): void {
    this.realtime = hub;
  }

  // ============ Private Database Methods ============

  private async findMockConversation(userId: string, personaId: string): Promise<MockConversation | null> {
    // For MVP, we'll store mock conversations in a separate table or use a prefix
    // Using the existing Conversation table with a special marker
    const conv = await rawPrisma.conversation.findFirst({
      where: {
        participant1Id: userId,
        participant2Id: personaId,
        // Could add a flag like isMockConversation: true
      },
    });

    if (!conv) return null;

    const persona = personaRegistry.getPersona(personaId);
    if (!persona) return null;

    const lastMessage = conv.lastMessageId 
      ? await rawPrisma.message.findUnique({ where: { id: conv.lastMessageId } })
      : null;

    return {
      id: conv.id,
      userId: conv.participant1Id,
      personaId: conv.participant2Id,
      personaName: persona.name,
      personaDisplayName: persona.displayName,
      personaAvatarUrl: persona.avatarUrl,
      lastMessageAt: conv.lastMessageAt,
      lastMessagePreview: lastMessage?.content?.substring(0, 100) || null,
      unreadCount: conv.unreadCountP1, // Assuming user is participant1
      isActive: conv.isActive,
      createdAt: conv.createdAt,
    };
  }

  private async findMockConversationById(conversationId: string): Promise<MockConversation | null> {
    const conv = await rawPrisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conv) return null;

    const persona = personaRegistry.getPersona(conv.participant2Id);
    if (!persona) return null;

    const lastMessage = conv.lastMessageId 
      ? await rawPrisma.message.findUnique({ where: { id: conv.lastMessageId } })
      : null;

    return {
      id: conv.id,
      userId: conv.participant1Id,
      personaId: conv.participant2Id,
      personaName: persona.name,
      personaDisplayName: persona.displayName,
      personaAvatarUrl: persona.avatarUrl,
      lastMessageAt: conv.lastMessageAt,
      lastMessagePreview: lastMessage?.content?.substring(0, 100) || null,
      unreadCount: conv.unreadCountP1,
      isActive: conv.isActive,
      createdAt: conv.createdAt,
    };
  }

  private async findUserMockConversations(userId: string): Promise<MockConversation[]> {
    const conversations = await rawPrisma.conversation.findMany({
      where: {
        participant1Id: userId,
        participant2Id: {
          in: personaRegistry.getActivePersonas().map(p => p.id),
        },
        isActive: true,
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    const results: MockConversation[] = [];
    for (const conv of conversations) {
      const persona = personaRegistry.getPersona(conv.participant2Id);
      if (!persona) continue;

      const lastMessage = conv.lastMessageId 
        ? await rawPrisma.message.findUnique({ where: { id: conv.lastMessageId } })
        : null;

      results.push({
        id: conv.id,
        userId: conv.participant1Id,
        personaId: conv.participant2Id,
        personaName: persona.name,
        personaDisplayName: persona.displayName,
        personaAvatarUrl: persona.avatarUrl,
        lastMessageAt: conv.lastMessageAt,
        lastMessagePreview: lastMessage?.content?.substring(0, 100) || null,
        unreadCount: conv.unreadCountP1,
        isActive: conv.isActive,
        createdAt: conv.createdAt,
      });
    }

    return results;
  }

  private async createMockConversation(userId: string, persona: MockPersonaConfig): Promise<MockConversation> {
    try {
      const conv = await rawPrisma.$transaction(async (tx) => {
        if (RLS_ENABLED) {
          await tx.$executeRawUnsafe(`SELECT set_config('app.bypass_rls', 'on', true)`);
        }
        return tx.conversation.create({
          data: {
            participant1Id: userId,
            participant2Id: persona.id,
            isActive: true,
          },
        });
      });

      logger.info({ userId, personaId: persona.id, conversationId: conv.id }, 'Created mock conversation');

      return {
        id: conv.id,
        userId: conv.participant1Id,
        personaId: conv.participant2Id,
        personaName: persona.name,
        personaDisplayName: persona.displayName,
        personaAvatarUrl: persona.avatarUrl,
        lastMessageAt: null,
        lastMessagePreview: null,
        unreadCount: 0,
        isActive: true,
        createdAt: conv.createdAt,
      };
    } catch (error) {
      logger.error({ error, userId, personaId: persona.id }, 'Failed to create mock conversation');
      throw new InternalError('Could not create conversation');
    }
  }

  private async saveMessage(data: {
    conversationId: string;
    senderId: string;
    senderType: 'user' | 'persona';
    content: string;
    imageUrl?: string;
  }): Promise<MockMessage> {
    try {
      const message = await rawPrisma.$transaction(async (tx) => {
        if (RLS_ENABLED) {
          await tx.$executeRawUnsafe(`SELECT set_config('app.bypass_rls', 'on', true)`);
        }
        return tx.message.create({
          data: {
            conversationId: data.conversationId,
            senderId: data.senderId,
            content: data.content,
            imageUrl: data.imageUrl ?? null,
            status: 'sent',
          },
        });
      });

      return {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        senderType: data.senderType,
        content: message.content,
        imageUrl: message.imageUrl,
        status: message.status,
        isEdited: message.isEdited,
        editedAt: message.editedAt,
        isDeleted: message.isDeleted,
        deletedAt: message.deletedAt,
        recalledAt: message.recalledAt,
        createdAt: message.createdAt,
      };
    } catch (error) {
      logger.error({ error, conversationId: data.conversationId }, 'Failed to save mock message');
      throw new InternalError('Could not send message');
    }
  }

  private async getConversationMessages(conversationId: string): Promise<MockMessage[]> {
    const messages = await rawPrisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map(msg => ({
      id: msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      senderType: personaRegistry.getPersona(msg.senderId) ? 'persona' : 'user',
      content: msg.content,
      imageUrl: msg.imageUrl,
      status: msg.status,
      isEdited: msg.isEdited,
      editedAt: msg.editedAt,
      isDeleted: msg.isDeleted,
      deletedAt: msg.deletedAt,
      recalledAt: msg.recalledAt,
      createdAt: msg.createdAt,
    }));
  }

  private async updateConversationLastMessage(conversationId: string, message: MockMessage): Promise<void> {
    try {
      await rawPrisma.$transaction(async (tx) => {
        if (RLS_ENABLED) {
          await tx.$executeRawUnsafe(`SELECT set_config('app.bypass_rls', 'on', true)`);
        }
        await tx.conversation.update({
          where: { id: conversationId },
          data: { 
            lastMessageId: message.id, 
            lastMessageAt: message.createdAt,
            // Increment unread count for the other participant
            ...(message.senderType === 'user' 
              ? { unreadCountP2: { increment: 1 } }
              : { unreadCountP1: { increment: 1 } }
            ),
          },
        });
      });
    } catch (error) {
      logger.error({ error, conversationId }, 'Failed to update conversation last message');
    }
  }

  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const limit = this.userRateLimits.get(userId);

    if (!limit || now > limit.resetAt) {
      this.userRateLimits.set(userId, { count: 1, resetAt: now + 60000 });
      return true;
    }

    if (limit.count >= this.config.rateLimitPerUserPerMinute) {
      return false;
    }

    limit.count++;
    return true;
  }

  private getResponseDelay(persona: MockPersonaConfig): number {
    const { min, max } = persona.communicationStyle.responseDelayMs;
    // Add some variance
    const baseDelay = min + Math.random() * (max - min);
    // Add configured base delay
    return Math.floor(baseDelay + this.config.responseDelayMs.min + Math.random() * (this.config.responseDelayMs.max - this.config.responseDelayMs.min));
  }

  private async broadcastMessage(conversationId: string, message: MockMessage): Promise<void> {
    if (this.realtime) {
      await this.realtime.broadcastMessage(conversationId, message);
    }
  }
}