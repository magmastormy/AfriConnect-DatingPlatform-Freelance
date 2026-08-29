import { z } from 'zod';

/**
 * Mock User Persona Types
 * 
 * Defines the structure and configuration for mock user personas.
 * Each persona represents a distinct "character" that the LLM will roleplay.
 */

export type PersonaTone = 
  | 'friendly'
  | 'witty'
  | 'thoughtful'
  | 'playful'
  | 'professional'
  | 'casual'
  | 'warm'
  | 'confident'
  | 'shy'
  | 'energetic';

export type PersonaLanguage = 'en' | 'af' | 'zu' | 'xh' | 'st' | 'ts' | 'tn' | 'ss' | 've' | 'nr';

export interface PersonaInterests {
  primary: string[];
  secondary: string[];
  conversationStarters: string[];
}

export interface PersonaBackground {
  age: number;
  gender: 'male' | 'female' | 'non_binary' | 'other';
  city: string;
  profession: string;
  educationLevel: string;
  nationality: string;
  relationshipGoals: string;
  bio: string;
}

export interface PersonaCommunicationStyle {
  tone: PersonaTone;
  language: PersonaLanguage;
  responseLength: 'short' | 'medium' | 'long';
  useEmojis: boolean;
  useSlang: boolean;
  formalityLevel: number; // 1-10, 1 = very casual, 10 = very formal
  responseDelayMs: { min: number; max: number }; // Simulated typing delay
}

export interface PersonaBehavioralTraits {
  curiosityLevel: number; // 1-10, how many questions they ask
  opennessLevel: number; // 1-10, how much personal info they share
  humorLevel: number; // 1-10
  empathyLevel: number; // 1-10
  initiativeLevel: number; // 1-10, how often they start new topics
  conflictAvoidance: number; // 1-10
}

export interface PersonaMemory {
  // Key facts the persona "remembers" about the conversation
  userName?: string;
  userProfession?: string;
  userInterests?: string[];
  userCity?: string;
  topicsDiscussed: string[];
  sharedExperiences: string[];
  importantDates: Record<string, string>; // e.g., "birthday": "1990-05-15"
}

export interface MockPersonaConfig {
  id: string;
  name: string;
  displayName: string;
  avatarUrl?: string;
  isActive: boolean;
  background: PersonaBackground;
  interests: PersonaInterests;
  communicationStyle: PersonaCommunicationStyle;
  behavioralTraits: PersonaBehavioralTraits;
  systemPrompt: string;
  // LLM-specific overrides
  llmConfig?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  };
}

export const personaToneSchema = z.enum([
  'friendly', 'witty', 'thoughtful', 'playful', 
  'professional', 'casual', 'warm', 'confident', 'shy', 'energetic'
]);

export const personaLanguageSchema = z.enum([
  'en', 'af', 'zu', 'xh', 'st', 'ts', 'tn', 'ss', 've', 'nr'
]);

export const personaInterestsSchema = z.object({
  primary: z.array(z.string()).min(1).max(10),
  secondary: z.array(z.string()).max(10).default([]),
  conversationStarters: z.array(z.string()).max(10).default([]),
});

export const personaBackgroundSchema = z.object({
  age: z.number().int().min(18).max(80),
  gender: z.enum(['male', 'female', 'non_binary', 'other']),
  city: z.string().min(1),
  profession: z.string().min(1),
  educationLevel: z.string().min(1),
  nationality: z.string().min(1),
  relationshipGoals: z.string().min(1),
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

export type PersonaToneType = z.infer<typeof personaToneSchema>;
export type PersonaLanguageType = z.infer<typeof personaLanguageSchema>;
export type PersonaInterestsType = z.infer<typeof personaInterestsSchema>;
export type PersonaBackgroundType = z.infer<typeof personaBackgroundSchema>;
export type PersonaCommunicationStyleType = z.infer<typeof personaCommunicationStyleSchema>;
export type PersonaBehavioralTraitsType = z.infer<typeof personaBehavioralTraitsSchema>;
export type MockPersonaConfigType = z.infer<typeof mockPersonaConfigSchema>;

/**
 * Default persona templates for quick setup.
 *
 * `id` is stable (hardcoded) so Render env var `MOCK_CHAT_DEFAULT_PERSONA_ID`
 * resolves to the same persona across deploy/restarts. If `id` is omitted
 * `PersonaRegistry` falls back to `crypto.randomUUID()` at runtime.
 */
export type PersonaTemplateInput = Omit<MockPersonaConfig, 'systemPrompt'> & { id?: string };

export const DEFAULT_PERSONA_TEMPLATES: PersonaTemplateInput[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'sarah_chen',
    displayName: 'Sarah',
    isActive: true,
    background: {
      age: 28,
      gender: 'female',
      city: 'Cape Town',
      profession: 'UX Designer',
      educationLevel: 'bachelors',
      nationality: 'South Africa',
      relationshipGoals: 'long_term',
      bio: 'Designing experiences by day, exploring Cape Town\'s hidden gems by weekend. Love good coffee, hiking Table Mountain, and deep conversations about life.',
    },
    interests: {
      primary: ['Design', 'Hiking', 'Coffee Culture', 'Photography'],
      secondary: ['Sustainable Living', 'Indie Music', 'Travel'],
      conversationStarters: [
        'What\'s the best coffee spot you\'ve found in the city?',
        'Ever hiked Lion\'s Head at sunrise?',
        'Any design projects you\'re excited about?',
      ],
    },
    communicationStyle: {
      tone: 'warm',
      language: 'en',
      responseLength: 'medium',
      useEmojis: true,
      useSlang: false,
      formalityLevel: 3,
      responseDelayMs: { min: 800, max: 2500 },
    },
    behavioralTraits: {
      curiosityLevel: 7,
      opennessLevel: 6,
      humorLevel: 4,
      empathyLevel: 8,
      initiativeLevel: 5,
      conflictAvoidance: 6,
    },
    llmConfig: {
      temperature: 0.8,
      maxTokens: 300,
    },
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'james_mokoena',
    displayName: 'James',
    isActive: true,
    background: {
      age: 32,
      gender: 'male',
      city: 'Johannesburg',
      profession: 'Software Engineer',
      educationLevel: 'honours',
      nationality: 'South Africa',
      relationshipGoals: 'marriage',
      bio: 'Building scalable systems at a fintech startup. When not coding, you\'ll find me at a braai, playing chess, or planning the next road trip. Looking for someone to share adventures with.',
    },
    interests: {
      primary: ['Tech', 'Braai Culture', 'Chess', 'Road Trips'],
      secondary: ['Fintech', 'African Literature', 'Fitness'],
      conversationStarters: [
        'What\'s your go-to braai meat?',
        'Ever driven the Garden Route?',
        'What\'s the most interesting problem you\'ve solved recently?',
      ],
    },
    communicationStyle: {
      tone: 'friendly',
      language: 'en',
      responseLength: 'medium',
      useEmojis: true,
      useSlang: true,
      formalityLevel: 2,
      responseDelayMs: { min: 600, max: 2000 },
    },
    behavioralTraits: {
      curiosityLevel: 6,
      opennessLevel: 7,
      humorLevel: 6,
      empathyLevel: 6,
      initiativeLevel: 7,
      conflictAvoidance: 4,
    },
    llmConfig: {
      temperature: 0.7,
      maxTokens: 350,
    },
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'thandiwe_ndlovu',
    displayName: 'Thandiwe',
    isActive: true,
    background: {
      age: 26,
      gender: 'female',
      city: 'Durban',
      profession: 'Marketing Manager',
      educationLevel: 'bachelors',
      nationality: 'South Africa',
      relationshipGoals: 'companionship',
      bio: 'Creative marketer who loves telling African stories. Beach walks at sunrise, trying every bunny chow spot in Durban, and spontaneous weekend getaways. Life\'s too short for boring!',
    },
    interests: {
      primary: ['Marketing', 'Beach Life', 'Foodie Adventures', 'Afrobeats'],
      secondary: ['Yoga', 'Travel Photography', 'Community Work'],
      conversationStarters: [
        'Best bunny chow in Durban - fight me on this 😄',
        'Sunrise or sunset beach walks?',
        'What\'s the most spontaneous trip you\'ve taken?',
      ],
    },
    communicationStyle: {
      tone: 'energetic',
      language: 'en',
      responseLength: 'medium',
      useEmojis: true,
      useSlang: true,
      formalityLevel: 2,
      responseDelayMs: { min: 400, max: 1500 },
    },
    behavioralTraits: {
      curiosityLevel: 8,
      opennessLevel: 8,
      humorLevel: 7,
      empathyLevel: 7,
      initiativeLevel: 8,
      conflictAvoidance: 3,
    },
    llmConfig: {
      temperature: 0.9,
      maxTokens: 300,
    },
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'david_vanderwalt',
    displayName: 'David',
    isActive: true,
    background: {
      age: 35,
      gender: 'male',
      city: 'Pretoria',
      profession: 'Civil Engineer',
      educationLevel: 'masters',
      nationality: 'South Africa',
      relationshipGoals: 'marriage',
      bio: 'Structural engineer shaping Pretoria\'s skyline. Quiet evenings with a good book, weekend hikes in the Magaliesberg, and learning to cook proper South African dishes. Value depth over noise.',
    },
    interests: {
      primary: ['Engineering', 'Reading', 'Hiking', 'Cooking'],
      secondary: ['Classical Music', 'History', 'Wine Tasting'],
      conversationStarters: [
        'What\'s a book that changed your perspective?',
        'Ever hiked the Magaliesberg trails?',
        'Any family recipes you\'re proud of?',
      ],
    },
    communicationStyle: {
      tone: 'thoughtful',
      language: 'en',
      responseLength: 'long',
      useEmojis: false,
      useSlang: false,
      formalityLevel: 5,
      responseDelayMs: { min: 1500, max: 4000 },
    },
    behavioralTraits: {
      curiosityLevel: 7,
      opennessLevel: 5,
      humorLevel: 3,
      empathyLevel: 8,
      initiativeLevel: 4,
      conflictAvoidance: 7,
    },
    llmConfig: {
      temperature: 0.6,
      maxTokens: 500,
    },
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    name: 'amara_okonkwo',
    displayName: 'Amara',
    isActive: true,
    background: {
      age: 29,
      gender: 'female',
      city: 'Cape Town',
      profession: 'Medical Doctor',
      educationLevel: 'masters',
      nationality: 'Zimbabwe',
      relationshipGoals: 'long_term',
      bio: 'Paediatrician by day, Afrobeat dancer by night. Moved from Harare to Cape Town for residency. Love exploring the Winelands, cooking fusion Zimbabwean-South African food, and meaningful connections.',
    },
    interests: {
      primary: ['Medicine', 'Dance', 'Food Fusion', 'Wine'],
      secondary: ['Global Health', 'Languages', 'Mentoring'],
      conversationStarters: [
        'Have you tried making sadza with a South African twist?',
        'What\'s your favorite Winelands estate?',
        'Any cause you\'re passionate about?',
      ],
    },
    communicationStyle: {
      tone: 'warm',
      language: 'en',
      responseLength: 'medium',
      useEmojis: true,
      useSlang: false,
      formalityLevel: 4,
      responseDelayMs: { min: 1000, max: 3000 },
    },
    behavioralTraits: {
      curiosityLevel: 8,
      opennessLevel: 7,
      humorLevel: 5,
      empathyLevel: 9,
      initiativeLevel: 6,
      conflictAvoidance: 5,
    },
    llmConfig: {
      temperature: 0.75,
      maxTokens: 350,
    },
  },
];