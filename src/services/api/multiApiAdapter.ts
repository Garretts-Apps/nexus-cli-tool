/**
 * Multi-API Adapter for Nexus
 *
 * Supports multiple LLM providers: Anthropic Claude, Google Gemini, and OpenAI
 * Provides a unified interface for API interactions across different providers
 *
 * Environment Variables:
 * - CLAUDE_CODE_API_PROVIDER: 'claude' (default), 'gemini', or 'openai'
 * - CLAUDE_CODE_API_KEY: API key for the selected provider
 * - CLAUDE_CODE_API_ENDPOINT: Custom API endpoint (optional)
 */

export type APIProvider = 'claude' | 'gemini' | 'openai'

export interface APIProviderConfig {
  provider: APIProvider
  apiKey: string
  endpoint?: string
  model?: string
}

export interface UnifiedMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

export interface ContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result'
  text?: string
  source?: { type: 'base64' | 'url'; media_type?: string; data?: string; url?: string }
  id?: string
  name?: string
  input?: Record<string, unknown>
  use_tool_id?: string
}

export interface UnifiedAPIResponse {
  id: string
  choices: Array<{
    message: { role: string; content: string }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  model: string
}

export interface StreamEvent {
  type: string
  delta?: { type: string; text?: string }
  message?: { stop_reason: string }
  usage?: { input_tokens: number; output_tokens: number }
  content_block?: { type: string }
}

/**
 * Gets the API provider configuration from environment variables or state
 */
export function getAPIProviderConfig(): APIProviderConfig {
  const provider = (process.env.CLAUDE_CODE_API_PROVIDER ||
    'claude') as APIProvider

  const configByProvider: Record<APIProvider, Partial<APIProviderConfig>> = {
    claude: {
      provider: 'claude',
      apiKey:
        process.env.CLAUDE_CODE_API_KEY || process.env.ANTHROPIC_API_KEY || '',
      endpoint: process.env.CLAUDE_CODE_API_ENDPOINT || 'https://api.anthropic.com',
      model: process.env.CLAUDE_CODE_MODEL || 'claude-3-5-sonnet-20241022',
    },
    gemini: {
      provider: 'gemini',
      apiKey:
        process.env.CLAUDE_CODE_API_KEY || process.env.GOOGLE_API_KEY || '',
      endpoint:
        process.env.CLAUDE_CODE_API_ENDPOINT ||
        'https://generativelanguage.googleapis.com/v1beta/models',
      model: process.env.CLAUDE_CODE_MODEL || 'gemini-2.0-flash',
    },
    openai: {
      provider: 'openai',
      apiKey:
        process.env.CLAUDE_CODE_API_KEY || process.env.OPENAI_API_KEY || '',
      endpoint: process.env.CLAUDE_CODE_API_ENDPOINT || 'https://api.openai.com/v1',
      model: process.env.CLAUDE_CODE_MODEL || 'gpt-4-turbo',
    },
  }

  const config = configByProvider[provider] as APIProviderConfig
  return config
}

/**
 * Validates that the API provider has necessary configuration
 */
export function validateAPIProviderConfig(config: APIProviderConfig): {
  valid: boolean
  error?: string
} {
  if (!config.apiKey) {
    return {
      valid: false,
      error: `API key not configured for provider: ${config.provider}. Set CLAUDE_CODE_API_KEY environment variable.`,
    }
  }

  if (!config.endpoint) {
    return {
      valid: false,
      error: `API endpoint not configured for provider: ${config.provider}`,
    }
  }

  return { valid: true }
}

/**
 * Normalizes request format from unified format to provider-specific format
 */
export function normalizeRequestForProvider(
  messages: UnifiedMessage[],
  systemPrompt: string,
  config: APIProviderConfig,
): Record<string, unknown> {
  const baseRequest = {
    messages: messages.map(msg => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : msg.content,
    })),
    system: systemPrompt,
    model: config.model,
  }

  switch (config.provider) {
    case 'claude':
      return {
        ...baseRequest,
        max_tokens: 4096,
        stream: true,
      }

    case 'gemini':
      return {
        contents: messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: typeof msg.content === 'string' ? msg.content : '' }],
        })),
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 1,
        },
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
      }

    case 'openai':
      return {
        ...baseRequest,
        max_tokens: 4096,
        temperature: 1,
        stream: true,
      }

    default:
      return baseRequest
  }
}

/**
 * Normalizes response format from provider-specific format to unified format
 */
export function normalizeResponseFromProvider(
  response: unknown,
  config: APIProviderConfig,
): UnifiedAPIResponse {
  switch (config.provider) {
    case 'claude': {
      const claudeResponse = response as any
      return {
        id: claudeResponse.id || '',
        choices: [
          {
            message: {
              role: 'assistant',
              content:
                claudeResponse.content?.[0]?.text ||
                claudeResponse.content ||
                '',
            },
            finish_reason: claudeResponse.stop_reason || 'end_turn',
          },
        ],
        usage: {
          prompt_tokens: claudeResponse.usage?.input_tokens || 0,
          completion_tokens: claudeResponse.usage?.output_tokens || 0,
          total_tokens:
            (claudeResponse.usage?.input_tokens || 0) +
            (claudeResponse.usage?.output_tokens || 0),
        },
        model: claudeResponse.model || config.model || '',
      }
    }

    case 'gemini': {
      const geminiResponse = response as any
      return {
        id: geminiResponse.id || '',
        choices: [
          {
            message: {
              role: 'assistant',
              content:
                geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text ||
                '',
            },
            finish_reason:
              geminiResponse.candidates?.[0]?.finishReason ||
              'STOP',
          },
        ],
        usage: {
          prompt_tokens:
            geminiResponse.usageMetadata?.promptTokenCount || 0,
          completion_tokens:
            geminiResponse.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: geminiResponse.usageMetadata?.totalTokenCount || 0,
        },
        model: config.model || '',
      }
    }

    case 'openai': {
      const openaiResponse = response as any
      return {
        id: openaiResponse.id || '',
        choices:
          openaiResponse.choices?.map((choice: any) => ({
            message: {
              role: choice.message?.role || 'assistant',
              content: choice.message?.content || '',
            },
            finish_reason: choice.finish_reason || 'stop',
          })) || [],
        usage: {
          prompt_tokens: openaiResponse.usage?.prompt_tokens || 0,
          completion_tokens:
            openaiResponse.usage?.completion_tokens || 0,
          total_tokens: openaiResponse.usage?.total_tokens || 0,
        },
        model: openaiResponse.model || config.model || '',
      }
    }

    default:
      throw new Error(`Unsupported provider: ${config.provider}`)
  }
}

/**
 * Gets the appropriate headers for the API provider
 */
export function getProviderHeaders(
  config: APIProviderConfig,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  switch (config.provider) {
    case 'claude':
      headers['x-api-key'] = config.apiKey
      headers['anthropic-version'] = '2023-06-01'
      break

    case 'gemini':
      // Gemini API key goes in URL query parameter, not header
      break

    case 'openai':
      headers['Authorization'] = `Bearer ${config.apiKey}`
      break
  }

  return headers
}

/**
 * Gets the API endpoint URL for a provider
 */
export function getProviderEndpoint(
  config: APIProviderConfig,
  action: string = 'messages',
): string {
  switch (config.provider) {
    case 'claude':
      return `${config.endpoint}/v1/${action}`

    case 'gemini':
      const model = config.model || 'gemini-2.0-flash'
      return `${config.endpoint}/${model}:generateContent?key=${config.apiKey}`

    case 'openai':
      return `${config.endpoint}/${action}`

    default:
      return ''
  }
}

/**
 * Checks if provider supports streaming
 */
export function providerSupportsStreaming(
  config: APIProviderConfig,
): boolean {
  // All supported providers support streaming
  return ['claude', 'gemini', 'openai'].includes(config.provider)
}

/**
 * Gets provider display name for UI/logging
 */
export function getProviderDisplayName(
  provider: APIProvider,
): string {
  const names: Record<APIProvider, string> = {
    claude: 'Anthropic Claude',
    gemini: 'Google Gemini',
    openai: 'OpenAI GPT',
  }
  return names[provider]
}

/**
 * Lists available providers for configuration UI
 */
export function getAvailableProviders(): Array<{
  id: APIProvider
  name: string
  description: string
}> {
  return [
    {
      id: 'claude',
      name: 'Anthropic Claude',
      description: 'Claude 3.5 Sonnet (default, recommended)',
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Gemini 2.0 Flash (fast, cost-effective)',
    },
    {
      id: 'openai',
      name: 'OpenAI GPT',
      description: 'GPT-4 Turbo (powerful, higher cost)',
    },
  ]
}
