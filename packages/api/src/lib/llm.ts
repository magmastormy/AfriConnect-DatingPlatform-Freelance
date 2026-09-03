import { logger } from '@africonnect/shared';

/**
 * LLM Provider Abstraction
 * 
 * Supports multiple LLM backends:
 * - OpenAI (hosted)
 * - Anthropic (hosted)
 * - Local (Ollama, llama.cpp, etc.)
 * 
 * All providers implement the same interface for easy swapping.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

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

export interface ILLMProvider {
  /**
   * Generate a completion from the LLM
   */
  complete(messages: LLMMessage[], config?: Partial<LLMProviderConfig>): Promise<LLMResponse>;

  /**
   * Generate a streaming completion (optional - can be implemented by providers that support it)
   */
  completeStream?(
    messages: LLMMessage[],
    config?: Partial<LLMProviderConfig>,
    onChunk?: (chunk: string) => void
  ): Promise<LLMResponse>;

  /**
   * Get the provider name for logging/debugging
   */
  readonly name: string;

  /**
   * Get the default model name
   */
  readonly defaultModel: string;

  /**
   * Check if the provider is available/configured
   */
  isAvailable(): boolean;
}

/**
 * Base class with common functionality
 */
export abstract class BaseLLMProvider implements ILLMProvider {
  abstract readonly name: string;
  abstract readonly defaultModel: string;
  protected config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  abstract complete(messages: LLMMessage[], config?: Partial<LLMProviderConfig>): Promise<LLMResponse>;
  abstract isAvailable(): boolean;

  protected getConfig(config?: Partial<LLMProviderConfig>): LLMProviderConfig {
    return { ...this.config, ...config };
  }

  protected logRequest(messages: LLMMessage[], config: LLMProviderConfig): void {
    logger.debug(
      {
        provider: this.name,
        model: config.model,
        messageCount: messages.length,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      },
      'LLM request',
    );
  }

  protected logResponse(response: LLMResponse): void {
    logger.debug(
      {
        provider: this.name,
        model: response.model,
        usage: response.usage,
        contentLength: response.content.length,
      },
      'LLM response',
    );
  }
}

/**
 * OpenAI-compatible provider (works with OpenAI, Azure OpenAI, and compatible APIs)
 */
export class OpenAIProvider extends BaseLLMProvider {
  readonly name = 'openai';
  readonly defaultModel = 'gpt-4o-mini';

  constructor(config: LLMProviderConfig) {
    super(config);
    if (!config.apiKey) {
      logger.warn('OpenAI API key not configured');
    }
  }

  async complete(messages: LLMMessage[], config?: Partial<LLMProviderConfig>): Promise<LLMResponse> {
    const mergedConfig = this.getConfig(config);
    this.logRequest(messages, mergedConfig);

    if (!mergedConfig.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const baseUrl = mergedConfig.baseUrl || 'https://api.openai.com/v1';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mergedConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: mergedConfig.model,
        messages,
        temperature: mergedConfig.temperature ?? 0.7,
        max_tokens: mergedConfig.maxTokens ?? 500,
        top_p: mergedConfig.topP ?? 1,
        frequency_penalty: mergedConfig.frequencyPenalty ?? 0,
        presence_penalty: mergedConfig.presencePenalty ?? 0,
        stream: false,
      }),
      signal: AbortSignal.timeout(mergedConfig.timeoutMs ?? 30000),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, status: response.status }, 'OpenAI API error');
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model?: string;
    };
    const result: LLMResponse = {
      content: data.choices[0]?.message?.content ?? '',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      model: data.model ?? mergedConfig.model,
    };

    this.logResponse(result);
    return result;
  }

  async completeStream(
    messages: LLMMessage[],
    config?: Partial<LLMProviderConfig>,
    onChunk?: (chunk: string) => void
  ): Promise<LLMResponse> {
    const mergedConfig = this.getConfig(config);
    this.logRequest(messages, mergedConfig);

    if (!mergedConfig.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const baseUrl = mergedConfig.baseUrl || 'https://api.openai.com/v1';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mergedConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: mergedConfig.model,
        messages,
        temperature: mergedConfig.temperature ?? 0.7,
        max_tokens: mergedConfig.maxTokens ?? 500,
        top_p: mergedConfig.topP ?? 1,
        frequency_penalty: mergedConfig.frequencyPenalty ?? 0,
        presence_penalty: mergedConfig.presencePenalty ?? 0,
        stream: true,
      }),
      signal: AbortSignal.timeout(mergedConfig.timeoutMs ?? 30000),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, status: response.status }, 'OpenAI API error (stream)');
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    let fullContent = '';
    let model = mergedConfig.model;
    let usage: LLMResponse['usage'];

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const chunk = parsed.choices[0]?.delta?.content ?? '';
            if (chunk) {
              fullContent += chunk;
              onChunk?.(chunk);
            }
            if (parsed.model) model = parsed.model;
            if (parsed.usage) {
              usage = {
                promptTokens: parsed.usage.prompt_tokens,
                completionTokens: parsed.usage.completion_tokens,
                totalTokens: parsed.usage.total_tokens,
              };
            }
          } catch {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }

    const result: LLMResponse = {
      content: fullContent,
      usage,
      model,
    };

    this.logResponse(result);
    return result;
  }

  isAvailable(): boolean {
    return Boolean(this.config.apiKey);
  }
}

/**
 * Anthropic (Claude) provider
 */
export class AnthropicProvider extends BaseLLMProvider {
  readonly name = 'anthropic';
  readonly defaultModel = 'claude-3-haiku-20240307';

  constructor(config: LLMProviderConfig) {
    super(config);
    if (!config.apiKey) {
      logger.warn('Anthropic API key not configured');
    }
  }

  async complete(messages: LLMMessage[], config?: Partial<LLMProviderConfig>): Promise<LLMResponse> {
    const mergedConfig = this.getConfig(config);
    this.logRequest(messages, mergedConfig);

    if (!mergedConfig.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    // Convert messages to Anthropic format
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': mergedConfig.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: mergedConfig.model,
        system: systemMessage?.content,
        messages: userMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: mergedConfig.temperature ?? 0.7,
        max_tokens: mergedConfig.maxTokens ?? 500,
        top_p: mergedConfig.topP ?? 1,
        stream: false,
      }),
      signal: AbortSignal.timeout(mergedConfig.timeoutMs ?? 30000),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, status: response.status }, 'Anthropic API error');
      throw new Error(`Anthropic API error: ${response.status} ${error}`);
    }

    const data = await response.json() as {
      content: Array<{ text?: string }>;
      usage?: { input_tokens: number; output_tokens: number };
      model?: string;
    };
    const result: LLMResponse = {
      content: data.content[0]?.text ?? '',
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
      model: data.model ?? mergedConfig.model,
    };

    this.logResponse(result);
    return result;
  }

  isAvailable(): boolean {
    return Boolean(this.config.apiKey);
  }
}

/**
 * Local LLM provider (Ollama-compatible API)
 * Works with Ollama, llama.cpp server, LM Studio, etc.
 */
export class LocalLLMProvider extends BaseLLMProvider {
  readonly name = 'local';
  readonly defaultModel = 'llama3.1:8b';

  constructor(config: LLMProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'http://localhost:11434',
    });
  }

  async complete(messages: LLMMessage[], config?: Partial<LLMProviderConfig>): Promise<LLMResponse> {
    const mergedConfig = this.getConfig(config);
    this.logRequest(messages, mergedConfig);

    const baseUrl = mergedConfig.baseUrl || 'http://localhost:11434';
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: mergedConfig.model,
        messages,
        options: {
          temperature: mergedConfig.temperature ?? 0.7,
          num_predict: mergedConfig.maxTokens ?? 500,
          top_p: mergedConfig.topP ?? 0.9,
          repeat_penalty: 1.1,
        },
        stream: false,
      }),
      signal: AbortSignal.timeout(mergedConfig.timeoutMs ?? 60000),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, status: response.status }, 'Local LLM API error');
      throw new Error(`Local LLM API error: ${response.status} ${error}`);
    }

    const data = await response.json() as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
      model?: string;
    };
    const result: LLMResponse = {
      content: data.message?.content ?? '',
      usage: data.prompt_eval_count || data.eval_count
        ? {
            promptTokens: data.prompt_eval_count ?? 0,
            completionTokens: data.eval_count ?? 0,
            totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
          }
        : undefined,
      model: data.model ?? mergedConfig.model,
    };

    this.logResponse(result);
    return result;
  }

  async completeStream(
    messages: LLMMessage[],
    config?: Partial<LLMProviderConfig>,
    onChunk?: (chunk: string) => void
  ): Promise<LLMResponse> {
    const mergedConfig = this.getConfig(config);
    this.logRequest(messages, mergedConfig);

    const baseUrl = mergedConfig.baseUrl || 'http://localhost:11434';
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: mergedConfig.model,
        messages,
        options: {
          temperature: mergedConfig.temperature ?? 0.7,
          num_predict: mergedConfig.maxTokens ?? 500,
          top_p: mergedConfig.topP ?? 0.9,
          repeat_penalty: 1.1,
        },
        stream: true,
      }),
      signal: AbortSignal.timeout(mergedConfig.timeoutMs ?? 60000),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, status: response.status }, 'Local LLM API error (stream)');
      throw new Error(`Local LLM API error: ${response.status} ${error}`);
    }

    let fullContent = '';
    let model = mergedConfig.model;
    let usage: LLMResponse['usage'];

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);
            const chunk = parsed.message?.content ?? '';
            if (chunk) {
              fullContent += chunk;
              onChunk?.(chunk);
            }
            if (parsed.model) model = parsed.model;
            if (parsed.prompt_eval_count || parsed.eval_count) {
              usage = {
                promptTokens: parsed.prompt_eval_count ?? 0,
                completionTokens: parsed.eval_count ?? 0,
                totalTokens: (parsed.prompt_eval_count ?? 0) + (parsed.eval_count ?? 0),
              };
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    const result: LLMResponse = {
      content: fullContent,
      usage,
      model,
    };

    this.logResponse(result);
    return result;
  }

  isAvailable(): boolean {
    return true; // Local provider is always "available" - will fail at runtime if not running
  }
}

/**
 * Mock provider for testing/development (no external dependencies)
 */
export class MockLLMProvider extends BaseLLMProvider {
  readonly name = 'mock';
  readonly defaultModel = 'mock-model';

  constructor(config: LLMProviderConfig = { model: 'mock-model' }) {
    super(config);
  }

  async complete(messages: LLMMessage[], config?: Partial<LLMProviderConfig>): Promise<LLMResponse> {
    const mergedConfig = this.getConfig(config);
    this.logRequest(messages, mergedConfig);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 500));

    // Extract the last user message and system prompt for context
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const systemMessage = messages.find(m => m.role === 'system');

    // Generate a contextual mock response
    let content = 'I understand. ';

    if (lastUserMessage) {
      const userContent = lastUserMessage.content.toLowerCase();
      
      if (userContent.includes('hello') || userContent.includes('hi') || userContent.includes('hey')) {
        content = 'Hello! It\'s nice to meet you. How are you doing today?';
      } else if (userContent.includes('how are you')) {
        content = 'I\'m doing well, thank you for asking! How about you?';
      } else if (userContent.includes('what do you do') || userContent.includes('work') || userContent.includes('job')) {
        content = 'I work in technology. It\'s challenging but rewarding. What about you?';
      } else if (userContent.includes('hobby') || userContent.includes('interest') || userContent.includes('fun')) {
        content = 'I enjoy reading, hiking, and trying new restaurants. What are your interests?';
      } else if (userContent.includes('weekend') || userContent.includes('plans')) {
        content = 'I\'m planning to relax and maybe catch up with friends. Do you have any plans?';
      } else if (userContent.includes('music') || userContent.includes('song')) {
        content = 'I listen to a bit of everything - jazz, indie, some electronic. What\'s your taste?';
      } else if (userContent.includes('travel') || userContent.includes('trip') || userContent.includes('vacation')) {
        content = 'I love traveling! Cape Town is on my bucket list. Have you been?';
      } else {
        content = 'That\'s interesting. Tell me more about that.';
      }
    }

    // Add personality variation based on system prompt
    if (systemMessage?.content.includes('witty') || systemMessage?.content.includes('humor')) {
      content += ' 😄';
    } else if (systemMessage?.content.includes('thoughtful') || systemMessage?.content.includes('deep')) {
      content = 'Hmm, ' + content.toLowerCase();
    }

    const result: LLMResponse = {
      content,
      usage: {
        promptTokens: Math.floor(Math.random() * 100) + 50,
        completionTokens: Math.floor(Math.random() * 100) + 20,
        totalTokens: Math.floor(Math.random() * 200) + 70,
      },
      model: mergedConfig.model,
    };

    this.logResponse(result);
    return result;
  }

  isAvailable(): boolean {
    return true;
  }
}

/**
 * Groq provider (OpenAI-compatible API optimized for speed)
 * Docs: https://console.groq.com/docs/overview
 */
export class GroqProvider extends BaseLLMProvider {
  readonly name = 'groq';
  // Groq switched llama-3.3-70b-versatile off for free/developer tiers on
  // 2026-08-16 and names openai/gpt-oss-120b as the production replacement.
  readonly defaultModel = 'openai/gpt-oss-120b';
  static readonly BASE_URL = 'https://api.groq.com/openai/v1';

  constructor(config: LLMProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || GroqProvider.BASE_URL,
    });
    if (!config.apiKey) {
      logger.warn('Groq API key not configured');
    }
  }

  /**
   * Builds a chat/completions request body.
   *
   * Groq's newer reasoning models (gpt-oss) document `max_completion_tokens`
   * and do not accept every legacy sampling parameter, while older models only
   * understand `max_tokens`. Any key listed in `omit` is left out entirely.
   */
  private buildBody(
    messages: LLMMessage[],
    cfg: LLMProviderConfig,
    stream: boolean,
    omit: ReadonlySet<string>,
  ): Record<string, unknown> {
    const maxTokens = cfg.maxTokens ?? 500;
    const body: Record<string, unknown> = { model: cfg.model, messages, stream };

    if (!omit.has('max_completion_tokens')) body.max_completion_tokens = maxTokens;
    else if (!omit.has('max_tokens')) body.max_tokens = maxTokens;

    if (!omit.has('temperature')) body.temperature = cfg.temperature ?? 0.7;
    if (!omit.has('top_p')) body.top_p = cfg.topP ?? 1;
    if (!omit.has('frequency_penalty')) body.frequency_penalty = cfg.frequencyPenalty ?? 0;
    if (!omit.has('presence_penalty')) body.presence_penalty = cfg.presencePenalty ?? 0;
    return body;
  }

  /**
   * Identifies which request parameter a Groq 400 is complaining about, so the
   * call can be replayed without it. Returns null when the failure is not a
   * parameter problem (a decommissioned model, for instance) — those must
   * surface to the caller rather than be retried.
   */
  private static rejectedParam(
    errorText: string,
    body: Record<string, unknown>,
    omit: ReadonlySet<string>,
  ): string | null {
    let message = errorText;
    try {
      const parsed = JSON.parse(errorText) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      /* Not JSON — match against the raw text instead. */
    }
    // `model`, `messages` and `stream` are never the fix: a decommissioned
    // model error quotes the model name, and retrying without it is pointless.
    for (const key of Object.keys(body)) {
      if (key === 'model' || key === 'messages' || key === 'stream') continue;
      if (omit.has(key)) continue;
      if (new RegExp(`\\b${key}\\b`).test(message)) return key;
    }
    return null;
  }

  /**
   * POSTs to Groq, replaying once per rejected parameter.
   *
   * Groq retires models on short notice and its reasoning models reject some
   * legacy sampling parameters. Reading the offending key out of the 400 keeps
   * this provider working across model generations without a code change, and
   * a decommissioned model still fails loudly instead of silently degrading.
   */
  private async post(
    messages: LLMMessage[],
    cfg: LLMProviderConfig,
    stream: boolean,
  ): Promise<Response> {
    const baseUrl = cfg.baseUrl || GroqProvider.BASE_URL;
    const omit = new Set<string>();

    for (;;) {
      const body = this.buildBody(messages, cfg, stream, omit);
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(cfg.timeoutMs ?? 30000),
      });
      if (response.status !== 400) return response;

      const errorText = await response.text();
      const rejected = GroqProvider.rejectedParam(errorText, body, omit);
      if (rejected === null) {
        logger.error({ error: errorText, status: 400, model: cfg.model }, 'Groq API error');
        throw new Error(`Groq API error: 400 ${errorText}`);
      }
      omit.add(rejected);
      logger.warn(
        { dropped: rejected, model: cfg.model },
        'Groq rejected a request parameter; retrying without it',
      );
    }
  }

  async complete(messages: LLMMessage[], config?: Partial<LLMProviderConfig>): Promise<LLMResponse> {
    const mergedConfig = this.getConfig(config);
    this.logRequest(messages, mergedConfig);

    if (!mergedConfig.apiKey) {
      throw new Error('Groq API key not configured');
    }

    const response = await this.post(messages, mergedConfig, false);

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, status: response.status }, 'Groq API error');
      throw new Error(`Groq API error: ${response.status} ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model?: string;
    };
    const result: LLMResponse = {
      content: data.choices[0]?.message?.content ?? '',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      model: data.model ?? mergedConfig.model,
    };

    this.logResponse(result);
    return result;
  }

  async completeStream(
    messages: LLMMessage[],
    config?: Partial<LLMProviderConfig>,
    onChunk?: (chunk: string) => void
  ): Promise<LLMResponse> {
    const mergedConfig = this.getConfig(config);
    this.logRequest(messages, mergedConfig);

    if (!mergedConfig.apiKey) {
      throw new Error('Groq API key not configured');
    }

    const response = await this.post(messages, mergedConfig, true);

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, status: response.status }, 'Groq API error (stream)');
      throw new Error(`Groq API error: ${response.status} ${error}`);
    }

    let fullContent = '';
    let model = mergedConfig.model;
    let usage: LLMResponse['usage'];

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const chunk = parsed.choices[0]?.delta?.content ?? '';
            if (chunk) {
              fullContent += chunk;
              onChunk?.(chunk);
            }
            if (parsed.model) model = parsed.model;
            if (parsed.usage) {
              usage = {
                promptTokens: parsed.usage.prompt_tokens,
                completionTokens: parsed.usage.completion_tokens,
                totalTokens: parsed.usage.total_tokens,
              };
            }
          } catch {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }

    const result: LLMResponse = {
      content: fullContent,
      usage,
      model,
    };

    this.logResponse(result);
    return result;
  }

  isAvailable(): boolean {
    return Boolean(this.config.apiKey);
  }
}

/**
 * Factory for creating LLM providers based on configuration
 */
export type LLMProviderType = 'openai' | 'anthropic' | 'groq' | 'local' | 'mock';

export interface LLMProviderFactoryConfig {
  provider: LLMProviderType;
  openai?: LLMProviderConfig;
  anthropic?: LLMProviderConfig;
  groq?: LLMProviderConfig;
  local?: LLMProviderConfig;
  mock?: LLMProviderConfig;
}

export function createLLMProvider(factoryConfig: LLMProviderFactoryConfig): ILLMProvider {
  const { provider, openai, anthropic, groq, local, mock } = factoryConfig;

  switch (provider) {
    case 'openai':
      return new OpenAIProvider(openai ?? { model: 'gpt-4o-mini' });
    case 'anthropic':
      return new AnthropicProvider(anthropic ?? { model: 'claude-3-haiku-20240307' });
    case 'groq':
      return new GroqProvider(groq ?? { model: 'openai/gpt-oss-120b' });
    case 'local':
      return new LocalLLMProvider(local ?? { model: 'llama3.1:8b', baseUrl: 'http://localhost:11434' });
    case 'mock':
      return new MockLLMProvider(mock ?? { model: 'mock-model' });
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

/**
 * Multi-provider with fallback support
 */
export class MultiLLMProvider implements ILLMProvider {
  readonly name = 'multi';
  readonly defaultModel = 'multi';
  private providers: ILLMProvider[];

  constructor(providers: ILLMProvider[]) {
    this.providers = providers.filter(p => p.isAvailable());
    if (this.providers.length === 0) {
      logger.warn('No LLM providers available, falling back to mock');
      this.providers.push(new MockLLMProvider());
    }
  }

  async complete(messages: LLMMessage[], config?: Partial<LLMProviderConfig>): Promise<LLMResponse> {
    let lastError: Error | null = null;

    for (const provider of this.providers) {
      try {
        return await provider.complete(messages, config);
      } catch (error) {
        lastError = error as Error;
        logger.warn({ provider: provider.name, error: lastError.message }, 'LLM provider failed, trying next');
      }
    }

    throw lastError ?? new Error('All LLM providers failed');
  }

  async completeStream(
    messages: LLMMessage[],
    config?: Partial<LLMProviderConfig>,
    onChunk?: (chunk: string) => void
  ): Promise<LLMResponse> {
    // Try streaming with first provider that supports it
    for (const provider of this.providers) {
      if (provider.completeStream) {
        try {
          return await provider.completeStream(messages, config, onChunk);
        } catch (error) {
          logger.warn({ provider: provider.name, error }, 'Streaming failed, trying next provider');
        }
      }
    }
    // Fallback to non-streaming
    return this.complete(messages, config);
  }

  isAvailable(): boolean {
    return this.providers.some(p => p.isAvailable());
  }
}