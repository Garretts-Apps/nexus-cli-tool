/**
 * Multi-provider LLM client abstraction
 *
 * This interface provides vendor-neutral access to LLM providers:
 * - Anthropic (Claude)
 * - AWS Bedrock
 * - Google Vertex AI
 * - Anthropic Foundry
 *
 * Design rationale:
 * - Decouples code from provider-specific SDKs
 * - Enables easy addition of new providers (OpenAI, Cohere, etc.)
 * - Preserves streaming semantics across all providers
 * - Type-safe with comprehensive type definitions
 */

/**
 * Request/Response Types
 */

export type ContentBlockType = 'text' | 'tool_use' | 'tool_result' | 'image'
export type MessageRole = 'user' | 'assistant'
export type StopReason = 'stop_sequence' | 'max_tokens' | 'tool_use' | 'end_turn' | null

export interface TextContentBlock {
  type: 'text'
  text: string
}

export interface ToolUseContentBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultContentBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

export interface ImageContentBlock {
  type: 'image'
  source: {
    type: 'base64' | 'url'
    media_type: string
    data?: string
    url?: string
  }
}

export type ContentBlock =
  | TextContentBlock
  | ToolUseContentBlock
  | ToolResultContentBlock
  | ImageContentBlock

export type ContentBlockParam = ContentBlock

export interface Message {
  id: string
  type: 'message'
  role: MessageRole
  content: ContentBlock[]
  model: string
  stop_reason: StopReason
  stop_sequence: string | null
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export type MessageParam =
  | { role: 'user'; content: string | ContentBlockParam[] }
  | { role: 'assistant'; content: ContentBlockParam[] }

/**
 * Tool definitions
 */
export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
}

/**
 * Message request parameters
 */
export interface MessageRequest {
  model: string
  max_tokens: number
  system?: string | Array<{ type: 'text'; text: string }>
  tools?: ToolDefinition[]
  messages: MessageParam[]
  temperature?: number
  top_p?: number
  top_k?: number
  stop_sequences?: string[]
  [key: string]: unknown
}

/**
 * Streaming events
 */
export interface ContentBlockStartEvent {
  type: 'content_block_start'
  index: number
  content_block: ContentBlock
}

export interface ContentBlockDeltaEvent {
  type: 'content_block_delta'
  index: number
  delta:
    | { type: 'text_delta'; text: string }
    | { type: 'input_json_delta'; partial_json: string }
}

export interface ContentBlockStopEvent {
  type: 'content_block_stop'
  index: number
}

export interface MessageStartEvent {
  type: 'message_start'
  message: Partial<Message>
}

export interface MessageDeltaEvent {
  type: 'message_delta'
  delta: {
    stop_reason?: StopReason
    stop_sequence?: string | null
  }
  usage: {
    output_tokens: number
  }
}

export interface MessageStopEvent {
  type: 'message_stop'
}

export interface PingEvent {
  type: 'ping'
}

export interface StreamErrorEvent {
  type: 'error'
  error: {
    type: string
    message: string
  }
}

export type StreamEvent =
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageStartEvent
  | MessageDeltaEvent
  | MessageStopEvent
  | PingEvent
  | StreamErrorEvent

/**
 * Streaming interface
 */
export interface Stream<T> extends AsyncIterable<T> {
  controller: AbortController
}

/**
 * Core LLM Client interface
 *
 * Implementations should handle:
 * - Authentication (API key, OAuth, etc.)
 * - Streaming and non-streaming requests
 * - Error handling and retries
 * - Provider-specific request/response translation
 */
export interface LLMClient {
  /**
   * Send a message to the LLM
   */
  messages: {
    /**
     * Create a message (non-streaming)
     */
    create(params: MessageRequest): Promise<Message>

    /**
     * Create a message stream
     */
    stream(params: MessageRequest): Stream<StreamEvent>
  }
}

/**
 * Factory for creating LLM clients
 */
export interface LLMClientFactory {
  /**
   * Create an LLM client for a specific provider
   *
   * @param provider - Provider name: 'anthropic', 'bedrock', 'vertex', 'foundry'
   * @param config - Provider-specific configuration
   * @returns LLMClient instance
   */
  createClient(
    provider: 'anthropic' | 'bedrock' | 'vertex' | 'foundry' | string,
    config: Record<string, unknown>
  ): LLMClient
}
