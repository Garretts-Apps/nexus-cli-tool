/**
 * AWS Bedrock adapter
 *
 * Wraps the @anthropic-ai/bedrock-sdk and implements the LLMClient interface
 *
 * TODO: Implement full Bedrock integration
 * - Handle AWS authentication (IAM, SigV4)
 * - Translate Bedrock API to LLMClient interface
 * - Support Bedrock model variants
 */

import type { LLMClient, Message, MessageRequest, Stream, StreamEvent } from './interface'

export class BedrockLLMClient implements LLMClient {
  messages = {
    create: (_params: MessageRequest): Promise<Message> => {
      throw new Error('Bedrock adapter not yet implemented')
    },
    stream: (_params: MessageRequest): Stream<StreamEvent> => {
      throw new Error('Bedrock adapter not yet implemented')
    },
  }

  constructor(_config: Record<string, unknown>) {
    // Initialize Bedrock client
  }
}

export function createBedrockLLMClient(config: Record<string, unknown>): LLMClient {
  return new BedrockLLMClient(config)
}
