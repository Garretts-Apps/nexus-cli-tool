/**
 * Anthropic SDK adapter
 *
 * Wraps the @anthropic-ai/sdk and implements the LLMClient interface
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  LLMClient,
  Message,
  MessageRequest,
  Stream,
  StreamEvent,
  ContentBlock,
  ToolDefinition,
} from './interface'
import { APIError, APIUserAbortError } from './types'

/**
 * Stream wrapper for Anthropic SDK
 */
class AnthropicStream implements Stream<StreamEvent> {
  controller: AbortController

  constructor(
    private sdkStream: AsyncIterable<Anthropic.RawMessageStreamEvent>,
    abortController: AbortController
  ) {
    this.controller = abortController
  }

  async *[Symbol.asyncIterator](): AsyncIterator<StreamEvent> {
    try {
      for await (const event of this.sdkStream) {
        // Translate Anthropic SDK events to our StreamEvent type
        yield this.translateEvent(event)
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('aborted')) {
        throw new APIUserAbortError()
      }
      throw error
    }
  }

  private translateEvent(event: Anthropic.RawMessageStreamEvent): StreamEvent {
    // Map SDK events to our interface, validating type safety
    // Support all event types the SDK produces
    if ('type' in event) {
      const type = (event as { type: string }).type

      // Recognize and validate event types
      const recognizedTypes = ['message_start', 'content_block_start', 'content_block_delta',
                             'content_block_stop', 'message_delta', 'message_stop', 'ping', 'error']
      if (recognizedTypes.includes(type)) {
        // Safe: type is one of our StreamEvent union members
        return event as StreamEvent
      }
    }

    // Unknown event type - log warning and return as error event
    // This prevents silent data loss from unrecognized SDK events
    console.warn('Unknown stream event type received from SDK:', event)
    return {
      type: 'error',
      error: {
        type: 'unknown_event',
        message: 'Received unknown event type from LLM stream'
      }
    }
  }
}

/**
 * Anthropic LLM Client implementation
 *
 * Accepts either:
 * - A pre-configured Anthropic client instance (recommended for reusing auth/proxy logic)
 * - An API key string (creates new client with minimal config)
 */
export class AnthropicLLMClient implements LLMClient {
  private client: Anthropic

  messages = {
    create: (params: MessageRequest): Promise<Message> => this.create(params),
    stream: (params: MessageRequest): Stream<StreamEvent> => this.stream(params),
  }

  constructor(clientOrApiKey?: Anthropic | string) {
    if (clientOrApiKey instanceof Anthropic) {
      // Option A: Accept pre-configured client (recommended)
      // This allows reusing all auth/proxy/header logic from existing client.ts
      this.client = clientOrApiKey
    } else {
      // Fallback: Create new client with just API key
      // Less flexible but works for simple cases
      this.client = new Anthropic({
        apiKey: clientOrApiKey || process.env.ANTHROPIC_API_KEY,
      })
    }
  }

  private async create(params: MessageRequest): Promise<Message> {
    try {
      const response = await this.client.messages.create({
        model: params.model,
        max_tokens: params.max_tokens,
        system: params.system as string | undefined,
        tools: this.translateTools(params.tools),
        messages: this.translateMessages(params.messages),
        temperature: params.temperature,
        top_p: params.top_p,
        top_k: params.top_k,
        stop_sequences: params.stop_sequences,
      })

      return this.translateMessage(response)
    } catch (error) {
      throw this.translateError(error)
    }
  }

  private stream(params: MessageRequest): Stream<StreamEvent> {
    // Create controller for this stream - note: this controller is separate from
    // the SDK's internal abort mechanism. In production, you may want to:
    // - Use the SDK's built-in abort mechanism if available
    // - Connect this controller to a timeout handler
    // - Forward abort calls to the underlying SDK stream
    const controller = new AbortController()

    const sdkStream = this.client.messages.stream({
      model: params.model,
      max_tokens: params.max_tokens,
      system: params.system as string | undefined,
      tools: this.translateTools(params.tools),
      messages: this.translateMessages(params.messages),
      temperature: params.temperature,
      top_p: params.top_p,
      top_k: params.top_k,
      stop_sequences: params.stop_sequences,
    })

    return new AnthropicStream(sdkStream, controller)
  }

  private translateTools(tools?: ToolDefinition[]): Anthropic.Tool[] {
    if (!tools) return []
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema as Anthropic.Tool['input_schema'],
    }))
  }

  private translateMessages(messages: MessageParam[]): Anthropic.MessageParam[] {
    return messages as Anthropic.MessageParam[]
  }

  private translateMessage(response: Anthropic.Message): Message {
    if (!response.id || !response.model || !response.usage) {
      throw new Error('Invalid response: missing required fields')
    }
    return {
      id: response.id,
      type: 'message',
      role: 'assistant',
      content: response.content as ContentBlock[],
      model: response.model,
      stop_reason: response.stop_reason as Message['stop_reason'],
      stop_sequence: response.stop_sequence ?? null,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    }
  }

  private translateError(error: unknown): Error {
    if (error instanceof Anthropic.APIError) {
      return new APIError(error.message, error.status, 'api_error')
    }
    if (error instanceof Anthropic.APIUserAbortError) {
      return new APIUserAbortError()
    }
    return error as Error
  }
}
