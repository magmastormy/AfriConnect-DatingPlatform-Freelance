import { logger } from '@africonnect/shared';
import { LLMMessage } from './llm.provider';
import { PersonaMemory, MockPersonaConfig } from './persona.types';

/**
 * Conversation Context Manager
 * 
 * Maintains conversation state and context for each mock user across conversations.
 * Handles:
 * - Message history per conversation
 * - Persona memory (facts learned about the user)
 * - Context window management for LLM
 * - Conversation summaries for long-term memory
 */

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokens?: number;
}

export interface ConversationContext {
  conversationId: string;
  personaId: string;
  userId: string; // The real user's ID
  messages: ConversationMessage[];
  memory: PersonaMemory;
  summary?: string;
  messageCount: number;
  totalTokens: number;
  createdAt: Date;
  updatedAt: Date;
  lastUserMessageAt?: Date;
  lastPersonaMessageAt?: Date;
}

export interface ContextManagerConfig {
  maxMessagesPerContext: number; // Max messages to keep in context window
  maxTokensPerContext: number; // Max tokens for context window
  summaryTriggerMessages: number; // Generate summary after this many messages
  summaryMaxLength: number; // Max length of summary
  memoryRetentionDays: number; // How long to keep persona memory
}

const DEFAULT_CONFIG: ContextManagerConfig = {
  maxMessagesPerContext: 20,
  maxTokensPerContext: 4000,
  summaryTriggerMessages: 15,
  summaryMaxLength: 500,
  memoryRetentionDays: 30,
};

export class ConversationContextManager {
  private contexts: Map<string, ConversationContext> = new Map();
  private config: ContextManagerConfig;

  constructor(config: Partial<ContextManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get or create a conversation context
   */
  getOrCreateContext(
    conversationId: string,
    personaId: string,
    userId: string,
    persona: MockPersonaConfig
  ): ConversationContext {
    let context = this.contexts.get(conversationId);
    
    if (!context) {
      context = {
        conversationId,
        personaId,
        userId,
        messages: [],
        memory: this.initializeMemory(persona),
        messageCount: 0,
        totalTokens: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.contexts.set(conversationId, context);
      logger.debug({ conversationId, personaId, userId }, 'Created new conversation context');
    }

    return context;
  }

  /**
   * Initialize persona memory with defaults
   */
  private initializeMemory(_persona: MockPersonaConfig): PersonaMemory {
    return {
      topicsDiscussed: [],
      sharedExperiences: [],
      importantDates: {},
      // These get populated as conversation progresses
      userName: undefined,
      userProfession: undefined,
      userInterests: undefined,
      userCity: undefined,
    };
  }

  /**
   * Add a user message to the conversation
   */
  addUserMessage(
    conversationId: string,
    messageId: string,
    content: string,
    tokens?: number
  ): ConversationContext | undefined {
    const context = this.contexts.get(conversationId);
    if (!context) return undefined;

    context.messages.push({
      id: messageId,
      role: 'user',
      content,
      timestamp: new Date(),
      tokens,
    });
    context.messageCount++;
    context.totalTokens += tokens || this.estimateTokens(content);
    context.lastUserMessageAt = new Date();
    context.updatedAt = new Date();

    this.maybeTrimContext(context);
    this.maybeGenerateSummary(context);

    return context;
  }

  /**
   * Add a persona (assistant) message to the conversation
   */
  addPersonaMessage(
    conversationId: string,
    messageId: string,
    content: string,
    tokens?: number
  ): ConversationContext | undefined {
    const context = this.contexts.get(conversationId);
    if (!context) return undefined;

    context.messages.push({
      id: messageId,
      role: 'assistant',
      content,
      timestamp: new Date(),
      tokens,
    });
    context.messageCount++;
    context.totalTokens += tokens || this.estimateTokens(content);
    context.lastPersonaMessageAt = new Date();
    context.updatedAt = new Date();

    this.maybeTrimContext(context);

    return context;
  }

  /**
   * Build the message array for LLM consumption
   * Includes system prompt, summary (if exists), and recent messages
   */
  buildLLMMessages(
    conversationId: string,
    _persona: MockPersonaConfig,
    systemPrompt: string
  ): LLMMessage[] {
    const context = this.contexts.get(conversationId);
    if (!context) {
      // No context yet - just system prompt
      return [{ role: 'system', content: systemPrompt }];
    }

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add summary if exists (as a system message for context)
    if (context.summary) {
      messages.push({
        role: 'system',
        content: `Conversation summary so far: ${context.summary}`,
      });
    }

    // Add relevant memory as context
    const memoryContext = this.formatMemoryForContext(context.memory);
    if (memoryContext) {
      messages.push({
        role: 'system',
        content: `Things you know about the user: ${memoryContext}`,
      });
    }

    // Add recent messages (respecting token limits)
    const recentMessages = this.getRecentMessagesForContext(context);
    messages.push(...recentMessages);

    return messages;
  }

  /**
   * Get recent messages that fit within token limit
   */
  private getRecentMessagesForContext(context: ConversationContext): LLMMessage[] {
    const messages: LLMMessage[] = [];
    let tokenCount = 0;
    const maxTokens = this.config.maxTokensPerContext;
    const maxMessages = this.config.maxMessagesPerContext;

    // Iterate backwards from most recent
    for (let i = context.messages.length - 1; i >= 0; i--) {
      const msg = context.messages[i];
      const msgTokens = msg.tokens || this.estimateTokens(msg.content);
      
      if (tokenCount + msgTokens > maxTokens && messages.length > 0) {
        break;
      }
      if (messages.length >= maxMessages) {
        break;
      }

      messages.unshift({
        role: msg.role,
        content: msg.content,
      });
      tokenCount += msgTokens;
    }

    return messages;
  }

  /**
   * Format persona memory for LLM context
   */
  private formatMemoryForContext(memory: PersonaMemory): string {
    const parts: string[] = [];

    if (memory.userName) parts.push(`Name: ${memory.userName}`);
    if (memory.userProfession) parts.push(`Profession: ${memory.userProfession}`);
    if (memory.userCity) parts.push(`City: ${memory.userCity}`);
    if (memory.userInterests && memory.userInterests.length > 0) {
      parts.push(`Interests: ${memory.userInterests.join(', ')}`);
    }
    if (memory.topicsDiscussed.length > 0) {
      parts.push(`Topics discussed: ${memory.topicsDiscussed.slice(-5).join(', ')}`);
    }
    if (memory.sharedExperiences.length > 0) {
      parts.push(`Shared experiences: ${memory.sharedExperiences.slice(-3).join('; ')}`);
    }
    if (Object.keys(memory.importantDates).length > 0) {
      const dates = Object.entries(memory.importantDates)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      parts.push(`Important dates: ${dates}`);
    }

    return parts.join(' | ');
  }

  /**
   * Update persona memory based on conversation
   */
  updateMemory(conversationId: string, updates: Partial<PersonaMemory>): ConversationContext | undefined {
    const context = this.contexts.get(conversationId);
    if (!context) return undefined;

    context.memory = { ...context.memory, ...updates };
    context.updatedAt = new Date();

    // Merge arrays instead of replacing
    if (updates.topicsDiscussed) {
      context.memory.topicsDiscussed = [
        ...new Set([...context.memory.topicsDiscussed, ...updates.topicsDiscussed]),
      ].slice(-20); // Keep last 20 topics
    }
    if (updates.sharedExperiences) {
      context.memory.sharedExperiences = [
        ...new Set([...context.memory.sharedExperiences, ...updates.sharedExperiences]),
      ].slice(-10);
    }
    if (updates.userInterests) {
      context.memory.userInterests = [
        ...new Set([...(context.memory.userInterests || []), ...updates.userInterests]),
      ].slice(-15);
    }

    return context;
  }

  /**
   * Extract and update memory from a user message
   * This is a simple heuristic - in production could use NLP/ML
   */
  extractMemoryFromMessage(conversationId: string, userMessage: string): void {
    const context = this.contexts.get(conversationId);
    if (!context) return;

    const lower = userMessage.toLowerCase();
    const updates: Partial<PersonaMemory> = {};

    // Extract name patterns
    const namePatterns = [
      /my name is (\w+)/i,
      /i'm (\w+)/i,
      /i am (\w+)/i,
      /call me (\w+)/i,
    ];
    for (const pattern of namePatterns) {
      const match = userMessage.match(pattern);
      if (match && match[1]) {
        updates.userName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
        break;
      }
    }

    // Extract profession
    const professionPatterns = [
      /i work as (?:a |an )?([^.]+)/i,
      /i'm a ([^.]+)/i,
      /i am a ([^.]+)/i,
      /my job is ([^.]+)/i,
      /profession is ([^.]+)/i,
    ];
    for (const pattern of professionPatterns) {
      const match = userMessage.match(pattern);
      if (match && match[1]) {
        updates.userProfession = match[1].trim();
        break;
      }
    }

    // Extract city
    const cityPatterns = [
      /i live in ([^.]+)/i,
      /i'm from ([^.]+)/i,
      /i am from ([^.]+)/i,
      /based in ([^.]+)/i,
    ];
    for (const pattern of cityPatterns) {
      const match = userMessage.match(pattern);
      if (match && match[1]) {
        updates.userCity = match[1].trim();
        break;
      }
    }

    // Extract interests (simple keyword matching)
    const interestKeywords = [
      'love', 'like', 'enjoy', 'passion', 'hobby', 'interested in',
      'fan of', 'into', 'favorite', 'favourite',
    ];
    for (const keyword of interestKeywords) {
      const regex = new RegExp(`${keyword} ([^.]+)`, 'i');
      const match = userMessage.match(regex);
      if (match && match[1]) {
        const interest = match[1].trim().split(/[,.]/)[0]; // Take first part
        if (interest.length > 2 && interest.length < 50) {
          updates.userInterests = [interest];
        }
        break;
      }
    }

    // Track topics discussed (simple keyword extraction)
    const topicKeywords = [
      'work', 'job', 'career', 'study', 'university', 'college',
      'travel', 'trip', 'vacation', 'holiday',
      'food', 'restaurant', 'cook', 'recipe',
      'music', 'concert', 'festival', 'band',
      'sport', 'fitness', 'gym', 'run', 'hike',
      'movie', 'film', 'series', 'netflix', 'book',
      'family', 'friend', 'relationship', 'dating',
      'tech', 'technology', 'code', 'programming', 'ai',
      'finance', 'investment', 'crypto', 'money',
      'health', 'doctor', 'medical', 'wellness',
    ];
    const newTopics = topicKeywords.filter(kw => lower.includes(kw));
    if (newTopics.length > 0) {
      updates.topicsDiscussed = newTopics;
    }

    if (Object.keys(updates).length > 0) {
      this.updateMemory(conversationId, updates);
    }
  }

  /**
   * Maybe trim context if it exceeds limits
   */
  private maybeTrimContext(context: ConversationContext): void {
    // Trim messages if too many
    if (context.messages.length > this.config.maxMessagesPerContext * 2) {
      // Keep the most recent messages
      const toKeep = this.config.maxMessagesPerContext;
      context.messages = context.messages.slice(-toKeep);
      // Recalculate tokens
      context.totalTokens = context.messages.reduce((sum, m) => sum + (m.tokens || this.estimateTokens(m.content)), 0);
    }

    // Trim tokens if too many
    if (context.totalTokens > this.config.maxTokensPerContext * 2) {
      // Remove oldest messages until under limit
      while (context.totalTokens > this.config.maxTokensPerContext && context.messages.length > 2) {
        const removed = context.messages.shift();
        if (removed) {
          context.totalTokens -= removed.tokens || this.estimateTokens(removed.content);
        }
      }
    }
  }

  /**
   * Maybe generate a conversation summary
   */
  private maybeGenerateSummary(context: ConversationContext): void {
    if (context.messageCount >= this.config.summaryTriggerMessages && !context.summary) {
      // In production, this would call an LLM to generate a summary
      // For now, create a simple heuristic summary
      const userMessages = context.messages.filter(m => m.role === 'user');
      const topics = context.memory.topicsDiscussed.slice(-5);
      const userName = context.memory.userName ? ` with ${context.memory.userName}` : '';
      
      context.summary = `Conversation${userName} covering ${topics.join(', ') || 'general topics'}. ${userMessages.length} user messages exchanged.`;
      logger.debug({ conversationId: context.conversationId }, 'Generated conversation summary');
    }
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get conversation context
   */
  getContext(conversationId: string): ConversationContext | undefined {
    return this.contexts.get(conversationId);
  }

  /**
   * Delete a conversation context
   */
  deleteContext(conversationId: string): boolean {
    return this.contexts.delete(conversationId);
  }

  /**
   * Get all contexts for a user (across all personas)
   */
  getUserContexts(userId: string): ConversationContext[] {
    return Array.from(this.contexts.values()).filter(c => c.userId === userId);
  }

  /**
   * Get all contexts for a persona
   */
  getPersonaContexts(personaId: string): ConversationContext[] {
    return Array.from(this.contexts.values()).filter(c => c.personaId === personaId);
  }

  /**
   * Clean up old contexts
   */
  cleanup(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [id, context] of this.contexts.entries()) {
      if (now - context.updatedAt.getTime() > maxAgeMs) {
        this.contexts.delete(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info({ cleaned }, 'Cleaned up old conversation contexts');
    }
    
    return cleaned;
  }

  /**
   * Get stats for monitoring
   */
  getStats(): {
    totalContexts: number;
    totalMessages: number;
    totalTokens: number;
    avgMessagesPerContext: number;
  } {
    const contexts = Array.from(this.contexts.values());
    return {
      totalContexts: contexts.length,
      totalMessages: contexts.reduce((sum, c) => sum + c.messageCount, 0),
      totalTokens: contexts.reduce((sum, c) => sum + c.totalTokens, 0),
      avgMessagesPerContext: contexts.length > 0 
        ? contexts.reduce((sum, c) => sum + c.messageCount, 0) / contexts.length 
        : 0,
    };
  }
}

// Export singleton instance
export const conversationContextManager = new ConversationContextManager();