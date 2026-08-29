# Mock Chat Module

## Overview

The Mock Chat module enables real-time conversations between real users and AI-powered mock personas. Each persona maintains a distinct, consistent personality across all conversations through a sophisticated LLM integration with persistent context management.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mock Chat Module                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌────────────────────┐  │
│  │   Persona   │    │ Conversation│    │      LLM           │  │
│  │   Registry  │◄───│  Context    │◄───│    Provider        │  │
│  │             │    │  Manager    │    │                    │  │
│  └─────────────┘    └─────────────┘    └────────────────────┘  │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    MockChatService                      │   │
│  │  • Conversation management                              │   │
│  │  • Message routing                                      │   │
│  │  • Persona response generation                          │   │
│  │  • Rate limiting                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Existing Chat Infrastructure               │   │
│  │  • Prisma (persistence)                                 │   │
│  │  • RealtimeHub (WebSocket broadcasting)                 │   │
│  │  • Authentication & Authorization                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Distinct Personas
Each mock user has a fully defined personality:
- **Background**: Age, gender, city, profession, education, bio
- **Interests**: Primary/secondary interests + conversation starters
- **Communication Style**: Tone, language, response length, emoji usage, slang, formality
- **Behavioral Traits**: Curiosity, openness, humor, empathy, initiative, conflict avoidance (1-10 scales)
- **System Prompt**: Auto-generated from all above for LLM consistency

### 2. Multiple LLM Providers
- **OpenAI** (GPT-4o-mini, GPT-4o, etc.)
- **Anthropic** (Claude 3 Haiku, Sonnet, Opus)
- **Local** (Ollama, llama.cpp, LM Studio - OpenAI-compatible API)
- **Mock** (No external dependencies, for testing)
- **Multi-provider with fallback** support

### 3. Context Persistence
- Per-conversation message history
- Persona memory (learned facts about the user)
- Automatic conversation summarization
- Token-aware context window management

### 4. Real-time Integration
- Uses existing `RealtimeHub` for WebSocket broadcasting
- Messages appear instantly in the user's chat UI
- No changes needed to frontend chat components

### 5. Modular Design
- Clean separation from real user-to-user chat
- Can be swapped for real users without refactoring
- Feature flag controlled (`MOCK_CHAT_ENABLED`)

## Configuration

### Environment Variables

```bash
# Enable the feature
MOCK_CHAT_ENABLED=true

# LLM Provider: openai | anthropic | local | mock
MOCK_CHAT_LLM_PROVIDER=openai

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-haiku-20240307

# Local (Ollama, etc.)
LOCAL_LLM_URL=http://localhost:11434
LOCAL_LLM_MODEL=llama3.1:8b

# Behavior
MOCK_CHAT_AUTO_RESPOND=true
MOCK_CHAT_RESPONSE_DELAY_MIN=500
MOCK_CHAT_RESPONSE_DELAY_MAX=2000
MOCK_CHAT_MAX_CONCURRENT=100
MOCK_CHAT_RATE_LIMIT=30
MOCK_CHAT_DEFAULT_PERSONA_ID=
```

### LLM Provider Setup

#### OpenAI
```bash
MOCK_CHAT_LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-4o-mini
```

#### Anthropic (Claude)
```bash
MOCK_CHAT_LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key
ANTHROPIC_MODEL=claude-3-haiku-20240307
```

#### Local (Ollama)
```bash
# Start Ollama
ollama serve
ollama pull llama3.1:8b

# Configure
MOCK_CHAT_LLM_PROVIDER=local
LOCAL_LLM_URL=http://localhost:11434
LOCAL_LLM_MODEL=llama3.1:8b
```

#### Mock (Testing)
```bash
MOCK_CHAT_LLM_PROVIDER=mock
# No API keys needed
```

## API Endpoints

All endpoints require authentication and vetting (same as regular chat).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/mockchat/personas` | List all available personas |
| GET | `/mockchat/personas/:id` | Get detailed persona info |
| GET | `/mockchat/conversations` | List user's mock conversations |
| POST | `/mockchat/conversations` | Create/get conversation with persona |
| GET | `/mockchat/conversations/:id` | Get messages for conversation |
| POST | `/mockchat/conversations/:id` | Send message to mock user |
| POST | `/mockchat/conversations/:id/read` | Mark conversation as read |

### Example Usage

```javascript
// 1. List available personas
const personas = await fetch('/api/v1/mockchat/personas', { headers: authHeaders });
// Returns: { personas: [{ id, name, displayName, avatarUrl, background, interests, communicationStyle }] }

// 2. Start conversation with a persona
const conversation = await fetch('/api/v1/mockchat/conversations', {
  method: 'POST',
  headers: { ...authHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({ personaId: 'uuid-of-persona' })
});

// 3. Send a message
const message = await fetch(`/api/v1/mockchat/conversations/${conversationId}`, {
  method: 'POST',
  headers: { ...authHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: 'Hi! How are you?' })
});
// Returns the persona's AI-generated response

// 4. Get conversation history
const messages = await fetch(`/api/v1/mockchat/conversations/${conversationId}`, { headers: authHeaders });
```

## Persona Configuration

### Default Personas
The module includes 5 diverse default personas:

1. **Sarah** (28, Cape Town) - UX Designer, warm, loves hiking & coffee
2. **James** (32, Johannesburg) - Software Engineer, friendly, braai & chess
3. **Thandiwe** (26, Durban) - Marketing Manager, energetic, beach & foodie
4. **David** (35, Pretoria) - Civil Engineer, thoughtful, reading & cooking
5. **Amara** (29, Cape Town) - Medical Doctor, warm, dance & wine

### Adding Custom Personas

```typescript
import { personaRegistry, MockPersonaConfig } from '@modules/mockchat';

const customPersona: MockPersonaConfig = {
  id: 'custom-uuid',
  name: 'my_custom_persona',
  displayName: 'Alex',
  isActive: true,
  background: {
    age: 30,
    gender: 'non_binary',
    city: 'Cape Town',
    profession: 'Data Scientist',
    educationLevel: 'masters',
    nationality: 'South Africa',
    relationshipGoals: 'long_term',
    bio: 'Passionate about AI ethics and climate tech...',
  },
  interests: {
    primary: ['Machine Learning', 'Climate Action', 'Hiking'],
    secondary: ['Photography', 'Indie Games'],
    conversationStarters: [
      'What\'s your take on AI regulation?',
      'Favorite hiking trail in the area?',
    ],
  },
  communicationStyle: {
    tone: 'thoughtful',
    language: 'en',
    responseLength: 'medium',
    useEmojis: false,
    useSlang: false,
    formalityLevel: 5,
    responseDelayMs: { min: 1000, max: 3000 },
  },
  behavioralTraits: {
    curiosityLevel: 8,
    opennessLevel: 6,
    humorLevel: 4,
    empathyLevel: 7,
    initiativeLevel: 6,
    conflictAvoidance: 5,
  },
  systemPrompt: '', // Auto-generated
  llmConfig: {
    temperature: 0.7,
    maxTokens: 400,
  },
};

personaRegistry.registerPersona(customPersona);
```

## Conversation Context Management

The `ConversationContextManager` maintains:

1. **Message History**: Last N messages (configurable, default 20)
2. **Persona Memory**: Facts learned about the user:
   - Name, profession, city
   - Interests mentioned
   - Topics discussed
   - Shared experiences
   - Important dates
3. **Conversation Summary**: Auto-generated after 15 messages
4. **Token Management**: Keeps context within LLM limits

### Memory Extraction
Automatically extracts from user messages:
- "My name is Alex" → `userName: "Alex"`
- "I work as a developer" → `userProfession: "developer"`
- "I live in Cape Town" → `userCity: "Cape Town"`
- "I love hiking" → `userInterests: ["hiking"]`
- Keywords → `topicsDiscussed`

## Testing

Run tests:
```bash
npm test -- --testPathPattern=mockchat
```

The test suite covers:
- LLM provider implementations
- Persona registry operations
- Conversation context management
- MockChatService integration

## Migration to Real Users

The module is designed for zero-refactor migration:

1. **Same Database Schema**: Uses existing `Conversation` and `Message` tables
2. **Same API Shape**: Endpoints mirror real chat endpoints
3. **Same WebSocket Events**: Broadcasts via existing `RealtimeHub`
4. **Persona ID ↔ User ID**: Mock personas use their UUID as `participant2Id`

To migrate:
1. Replace `personaId` with real `targetUserId` in `createConversation`
2. Remove auto-respond logic
3. Messages flow user-to-user instead of user-to-LLM

## Monitoring & Observability

Key metrics to monitor:
- `mockchat.conversations.created` - New conversations started
- `mockchat.messages.sent` - User messages sent
- `mockchat.llm.latency` - LLM response time
- `mockchat.llm.errors` - LLM failures (fallback triggered)
- `mockchat.rate_limit.exceeded` - Rate limit hits

## Security Considerations

1. **No PII in Prompts**: System prompts contain only persona config, no user data
2. **Rate Limiting**: Per-user per-minute limits prevent abuse
3. **Authentication Required**: All endpoints gated by auth + vetting
4. **Input Validation**: All inputs validated via Zod schemas
5. **Error Handling**: Graceful fallback to mock responses on LLM failure

## Future Enhancements

- [ ] Streaming responses for real-time typing effect
- [ ] Persona mood/emotion state tracking
- [ ] Multi-language support (Afrikaans, Zulu, Xhosa)
- [ ] Voice message support (TTS integration)
- [ ] Persona relationship progression (friendship → dating)
- [ ] A/B testing framework for persona variants
- [ ] Analytics dashboard for conversation quality