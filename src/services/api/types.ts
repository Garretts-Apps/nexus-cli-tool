/**
 * Local type definitions for LLM message types
 *
 * Origin: Based on Anthropic SDK v1.0.0+ types
 *
 * These types are the canonical definitions for the codebase.
 * All imports of message types should come from this file, not from external SDKs.
 *
 * This enables:
 * - Provider independence
 * - Easy SDK migration
 * - Type consistency across adapters
 */

import type {
  ContentBlock,
  ContentBlockParam,
  Message,
  MessageParam,
  MessageRequest,
  StreamEvent,
  TextContentBlock,
  ToolUseContentBlock,
  ToolResultContentBlock,
  ImageContentBlock,
  ToolDefinition,
  StopReason,
  MessageRole,
} from './interface'

// Re-export from interface for convenience
export type {
  ContentBlock,
  ContentBlockParam,
  Message,
  MessageParam,
  MessageRequest,
  StreamEvent,
  TextContentBlock,
  ToolUseContentBlock,
  ToolResultContentBlock,
  ImageContentBlock,
  ToolDefinition,
  StopReason,
  MessageRole,
}

/**
 * Error types
 */

export class APIError extends Error {
  status: number
  type: string
  headers?: Record<string, string> | Headers | null

  constructor(message: string, status: number, type = 'api_error', headers?: Record<string, string> | Headers | null) {
    super(message)
    this.status = status
    this.type = type
    this.headers = headers
    this.name = 'APIError'
  }
}

export class APIUserAbortError extends Error {
  constructor(message = 'Request was aborted by the user') {
    super(message)
    this.name = 'APIUserAbortError'
  }
}

export class APIConnectionError extends Error {
  constructor(message = 'Connection error') {
    super(message)
    this.name = 'APIConnectionError'
  }
}

export class APIConnectionTimeoutError extends Error {
  constructor(messageOrConfig?: string | { message?: string }) {
    // Support both string message and SDK-style { message } object
    const message = typeof messageOrConfig === 'string'
      ? messageOrConfig
      : messageOrConfig?.message || 'Connection timeout'

    super(message)
    this.name = 'APIConnectionTimeoutError'
  }
}

export class RateLimitError extends APIError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'rate_limit_error')
    this.name = 'RateLimitError'
  }
}

export class AuthenticationError extends APIError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'authentication_error')
    this.name = 'AuthenticationError'
  }
}

/**
 * Usage information
 */
export interface Usage {
  input_tokens: number
  output_tokens: number
}

/**
 * Cost tracking
 */
export interface ModelCost {
  input_cost_per_mtok: number
  output_cost_per_mtok: number
}

/**
 * Beta API types (for future compatibility and SDK migration)
 *
 * These are aliases and extensions to support the Anthropic SDK's beta API surface.
 * As the API stabilizes, these may be moved to the main interface or deprecated.
 */
export interface BetaMessage extends Message {
  usage?: Usage
}

// Core Beta types
export type BetaRawMessageStreamEvent = StreamEvent
export type BetaMessageStreamParams = MessageRequest
export type BetaMessageParam = MessageParam

// Content block types (required by claude.ts streaming)
export type BetaContentBlock = ContentBlock
export type BetaContentBlockParam = ContentBlockParam
export type BetaImageBlockParam = ImageContentBlock
export type BetaRequestDocumentBlock = ContentBlock
export type BetaToolResultBlockParam = ToolResultContentBlock

// Stop/tool choice enums (for API control)
export type BetaStopReason = StopReason
export type BetaToolChoiceAuto = { type: 'auto' }
export type BetaToolChoiceTool = { type: 'tool'; name: string }

// Tool and message variants
export type BetaToolUnion = ToolDefinition
export type BetaToolUseBlockParam = ToolUseContentBlock
export type BetaUsage = Usage
export type BetaMessageDeltaUsage = Usage

// Text content block param (required by claude.ts)
export type TextBlockParam = TextContentBlock & { type: 'text' }

// Output and formatting
export interface BetaJSONOutputFormat {
  type: 'json_object'
  json_schema?: Record<string, unknown>
}

export interface BetaOutputConfig {
  type: 'text' | 'json'
  schema?: Record<string, unknown>
}

export type { Stream } from './interface'

/**
 * Common type aliases for backward compatibility
 */
export type Tool = ToolDefinition
export type ToolUseBlock = ToolUseContentBlock
export type ToolResultBlockParam = ToolResultContentBlock

/**
 * Telemetry type bridges
 *
 * AttributedCounter from existing state/telemetryProviders.ts is structurally
 * compatible with the new Counter interface from utils/telemetry/interface.ts
 */
import type { Counter } from '../../utils/telemetry/interface'
export type AttributedCounter = Counter
