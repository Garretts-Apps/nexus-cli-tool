/**
 * Google Vertex AI adapter
 *
 * Wraps the @anthropic-ai/vertex-sdk and implements the LLMClient interface
 *
 * TODO: Implement full Vertex integration
 * - Handle Google Cloud authentication
 * - Translate Vertex API to LLMClient interface
 * - Support Vertex model variants and regional endpoints
 */

import type { LLMClient, Message, MessageRequest, Stream, StreamEvent } from './interface'

export class VertexLLMClient implements LLMClient {
  messages = {
    create: (_params: MessageRequest): Promise<Message> => {
      throw new Error('Vertex adapter not yet implemented')
    },
    stream: (_params: MessageRequest): Stream<StreamEvent> => {
      throw new Error('Vertex adapter not yet implemented')
    },
  }

  constructor(_config: Record<string, unknown>) {
    // Initialize Vertex client
  }
}

export function createVertexLLMClient(config: Record<string, unknown>): LLMClient {
  return new VertexLLMClient(config)
}
