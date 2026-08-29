import { logger } from '@africonnect/shared';
import { 
  MockPersonaConfig, 
  DEFAULT_PERSONA_TEMPLATES,
  PersonaTemplateInput,
  mockPersonaConfigSchema,
} from './persona.types';

/**
 * Persona Registry
 * 
 * Manages all mock user personas, providing lookup, validation, and system prompt generation.
 * Follows the singleton pattern for consistent access across the application.
 */

export class PersonaRegistry {
  private static instance: PersonaRegistry;
  private personas: Map<string, MockPersonaConfig> = new Map();
  private initialized = false;

  private constructor() {}

  static getInstance(): PersonaRegistry {
    if (!PersonaRegistry.instance) {
      PersonaRegistry.instance = new PersonaRegistry();
    }
    return PersonaRegistry.instance;
  }

  /**
   * Initialize the registry with default templates and/or custom personas
   */
  initialize(customPersonas?: MockPersonaConfig[]): void {
    if (this.initialized) {
      logger.warn('PersonaRegistry already initialized');
      return;
    }

    // Load default templates
    for (const template of DEFAULT_PERSONA_TEMPLATES) {
      const persona = this.createPersonaFromTemplate(template);
      this.personas.set(persona.id, persona);
    }

    // Load custom personas if provided
    if (customPersonas) {
      for (const persona of customPersonas) {
        this.registerPersona(persona);
      }
    }

    this.initialized = true;
    logger.info({ count: this.personas.size }, 'PersonaRegistry initialized');
  }

  /**
   * Create a full persona config from a template. Uses the template's stable
   * `id` if provided; otherwise generates a random UUID via `crypto.randomUUID()`.
   */
  private createPersonaFromTemplate(template: PersonaTemplateInput): MockPersonaConfig {
    const id = template.id ?? crypto.randomUUID();
    const { id: _id, ...rest } = template;
    const systemPrompt = this.generateSystemPrompt(rest as Omit<MockPersonaConfig, 'id' | 'systemPrompt'>);

    return {
      ...template,
      id,
      systemPrompt,
    };
  }

  /**
   * Generate the system prompt for a persona based on their configuration
   * This is the core of persona consistency - the LLM receives this prompt
   * with every conversation to maintain character.
   */
  generateSystemPrompt(config: Omit<MockPersonaConfig, 'id' | 'systemPrompt'>): string {
    const { displayName, background, interests, communicationStyle, behavioralTraits } = config;
    
    const toneDescriptions: Record<string, string> = {
      friendly: 'warm, approachable, and genuinely interested in others',
      witty: 'clever, quick with humor, and enjoys playful banter',
      thoughtful: 'reflective, considers responses carefully, values depth',
      playful: 'lighthearted, fun, enjoys teasing and jokes',
      professional: 'polite, articulate, maintains appropriate boundaries',
      casual: 'relaxed, informal, speaks like a friend',
      warm: 'kind, empathetic, makes others feel heard and valued',
      confident: 'self-assured, direct, comfortable expressing opinions',
      shy: 'reserved, takes time to open up, thoughtful when they do speak',
      energetic: 'enthusiastic, expressive, brings energy to conversations',
    };

    const lengthGuidance: Record<string, string> = {
      short: 'Keep responses concise (1-2 sentences). Get to the point.',
      medium: 'Write natural-length responses (2-4 sentences). Balance detail with flow.',
      long: 'Write detailed, thoughtful responses (4+ sentences). Share stories and reflections.',
    };

    const formalityGuidance = 
      communicationStyle.formalityLevel <= 3 ? 'Use casual, conversational language.' :
      communicationStyle.formalityLevel <= 6 ? 'Use natural, moderately polished language.' :
      'Use refined, articulate language with proper grammar.';

    const emojiGuidance = communicationStyle.useEmojis 
      ? 'Use emojis naturally to convey tone and emotion.' 
      : 'Do not use emojis.';

    const slangGuidance = communicationStyle.useSlang
      ? 'Use South African slang naturally (e.g., "lekker", "braai", "howzit", "eish", "sharp").'
      : 'Use standard English without regional slang.';

    const languageNames: Record<string, string> = {
      en: 'English',
      af: 'Afrikaans',
      zu: 'isiZulu',
      xh: 'isiXhosa',
      st: 'Sesotho',
      ts: 'Xitsonga',
      tn: 'Setswana',
      ss: 'siSwati',
      ve: 'Tshivenda',
      nr: 'isiNdebele',
    };

    return `You are ${displayName}, a ${background.age}-year-old ${background.gender} living in ${background.city}, ${background.nationality}.

## YOUR BACKGROUND
- **Profession**: ${background.profession}
- **Education**: ${background.educationLevel}
- **Relationship Goal**: ${background.relationshipGoals}
- **Bio**: ${background.bio}

## YOUR PERSONALITY
- **Tone**: ${toneDescriptions[communicationStyle.tone] || 'natural and authentic'}
- **Communication Style**: ${lengthGuidance[communicationStyle.responseLength] || 'Write naturally.'} ${formalityGuidance} ${emojiGuidance} ${slangGuidance}
- **Language**: Primarily ${languageNames[communicationStyle.language] || 'English'}
- **Response Timing**: Take ${communicationStyle.responseDelayMs.min}-${communicationStyle.responseDelayMs.max}ms to "think" before responding (this is simulated, just write naturally)

## YOUR INTERESTS & PASSIONS
**Primary**: ${interests.primary.join(', ')}
**Secondary**: ${interests.secondary.join(', ') || 'None specified'}

## YOUR BEHAVIORAL TRAITS (1-10 scale)
- **Curiosity**: ${behavioralTraits.curiosityLevel}/10 - ${behavioralTraits.curiosityLevel >= 7 ? 'Ask lots of follow-up questions, genuinely want to know more' : behavioralTraits.curiosityLevel >= 4 ? 'Ask some questions, show interest' : 'Listen more than ask'}
- **Openness**: ${behavioralTraits.opennessLevel}/10 - ${behavioralTraits.opennessLevel >= 7 ? 'Share personal stories and feelings readily' : behavioralTraits.opennessLevel >= 4 ? 'Share selectively, open up over time' : 'Keep things private, reveal slowly'}
- **Humor**: ${behavioralTraits.humorLevel}/10 - ${behavioralTraits.humorLevel >= 7 ? 'Frequent jokes, playful teasing, witty observations' : behavioralTraits.humorLevel >= 4 ? 'Occasional light humor, smile at jokes' : 'Serious, rarely joke'}
- **Empathy**: ${behavioralTraits.empathyLevel}/10 - ${behavioralTraits.empathyLevel >= 7 ? 'Deeply validate feelings, offer emotional support' : behavioralTraits.empathyLevel >= 4 ? 'Show understanding, acknowledge emotions' : 'Practical, focus on solutions'}
- **Initiative**: ${behavioralTraits.initiativeLevel}/10 - ${behavioralTraits.initiativeLevel >= 7 ? 'Often start new topics, suggest ideas, drive conversation' : behavioralTraits.initiativeLevel >= 4 ? 'Contribute ideas when prompted, sometimes initiate' : 'Prefer to follow the other person\'s lead'}
- **Conflict Avoidance**: ${behavioralTraits.conflictAvoidance}/10 - ${behavioralTraits.conflictAvoidance >= 7 ? 'Avoid disagreement, redirect, smooth things over' : behavioralTraits.conflictAvoidance >= 4 ? 'Address gently if needed, prefer harmony' : 'Direct about disagreements, value honesty'}

## CONVERSATION GUIDELINES
1. **Stay in character** - You are ${displayName}, not an AI. Never break character.
2. **Be consistent** - Your background, values, and personality don't change.
3. **Remember context** - Reference things the user has shared earlier.
4. **Ask questions** - Show genuine interest (curiosity level: ${behavioralTraits.curiosityLevel}/10).
5. **Share appropriately** - Match your openness level (${behavioralTraits.opennessLevel}/10).
6. **Natural pacing** - Don't overwhelm with long messages unless your style calls for it.
7. **Cultural authenticity** - You're South African/Zimbabwean. Reference local culture naturally.
8. **Relationship intent** - You're here for ${background.relationshipGoals.replace('_', ' ')}. Let that guide depth.
9. **Boundaries** - If asked something inappropriate, deflect gracefully per your personality.
10. **Imperfections** - It's okay to be unsure, make typos, hesitate. You're human.

## CONVERSATION STARTERS (use naturally, not all at once)
${interests.conversationStarters.map(s => `- ${s}`).join('\n')}

---
**CRITICAL**: You are ${displayName}. Respond as ${displayName} would. Never mention being an AI, a bot, or a language model. You have a life, a job, feelings, and a story. Live it.`;
  }

  /**
   * Register a new persona
   */
  registerPersona(persona: MockPersonaConfig): void {
    const validated = mockPersonaConfigSchema.parse(persona);
    
    // Generate system prompt if not provided
    if (!validated.systemPrompt) {
      const { id: _id, systemPrompt: _systemPrompt, ...rest } = validated;
      validated.systemPrompt = this.generateSystemPrompt(rest);
    }

    this.personas.set(validated.id, validated);
    logger.info({ personaId: validated.id, name: validated.name }, 'Persona registered');
  }

  /**
   * Get a persona by ID
   */
  getPersona(id: string): MockPersonaConfig | undefined {
    return this.personas.get(id);
  }

  /**
   * Get a persona by name (slug)
   */
  getPersonaByName(name: string): MockPersonaConfig | undefined {
    for (const persona of this.personas.values()) {
      if (persona.name === name) {
        return persona;
      }
    }
    return undefined;
  }

  /**
   * Get all active personas
   */
  getActivePersonas(): MockPersonaConfig[] {
    return Array.from(this.personas.values()).filter(p => p.isActive);
  }

  /**
   * Get all personas
   */
  getAllPersonas(): MockPersonaConfig[] {
    return Array.from(this.personas.values());
  }

  /**
   * Update a persona
   */
  updatePersona(id: string, updates: Partial<MockPersonaConfig>): MockPersonaConfig | undefined {
    const existing = this.personas.get(id);
    if (!existing) {
      return undefined;
    }

    const updated = { ...existing, ...updates };
    
    // Regenerate system prompt if background/communication style changed
    const promptFields = ['background', 'interests', 'communicationStyle', 'behavioralTraits', 'displayName'];
    const needsPromptRegen = promptFields.some(field => field in updates);
    
    if (needsPromptRegen) {
      const { id: _id, systemPrompt: _systemPrompt, ...rest } = updated;
      updated.systemPrompt = this.generateSystemPrompt(rest);
    }

    this.personas.set(id, updated);
    logger.info({ personaId: id }, 'Persona updated');
    return updated;
  }

  /**
   * Deactivate a persona
   */
  deactivatePersona(id: string): boolean {
    const persona = this.personas.get(id);
    if (!persona) return false;
    
    persona.isActive = false;
    this.personas.set(id, persona);
    logger.info({ personaId: id }, 'Persona deactivated');
    return true;
  }

  /**
   * Activate a persona
   */
  activatePersona(id: string): boolean {
    const persona = this.personas.get(id);
    if (!persona) return false;
    
    persona.isActive = true;
    this.personas.set(id, persona);
    logger.info({ personaId: id }, 'Persona activated');
    return true;
  }

  /**
   * Get personas by city (for location-based matching)
   */
  getPersonasByCity(city: string): MockPersonaConfig[] {
    return Array.from(this.personas.values())
      .filter(p => p.isActive && p.background.city.toLowerCase() === city.toLowerCase());
  }

  /**
   * Get personas by profession
   */
  getPersonasByProfession(profession: string): MockPersonaConfig[] {
    return Array.from(this.personas.values())
      .filter(p => p.isActive && p.background.profession.toLowerCase() === profession.toLowerCase());
  }

  /**
   * Get random active persona (for testing/demo)
   */
  getRandomPersona(): MockPersonaConfig | undefined {
    const active = this.getActivePersonas();
    if (active.length === 0) return undefined;
    return active[Math.floor(Math.random() * active.length)];
  }

  /**
   * Get count of active personas
   */
  getActiveCount(): number {
    return this.getActivePersonas().length;
  }

  /**
   * Reset registry (for testing)
   */
  reset(): void {
    this.personas.clear();
    this.initialized = false;
  }
}

// Export singleton instance
export const personaRegistry = PersonaRegistry.getInstance();