/**
 * LLM Client Factory
 *
 * Creates provider-specific LLM clients and returns them via the LLMClient interface
 *
 * Supports both:
 * - Pre-configured SDK clients (recommended - reuses auth/proxy/header logic)
 * - API keys (simple mode - creates new client)
 */

import Anthropic from '@anthropic-ai/sdk'
import type { LLMClient, LLMClientFactory } from './interface'
import { AnthropicLLMClient } from './anthropic-adapter'

/**
 * Factory implementation
 */
export const createLLMClientFactory = (): LLMClientFactory => ({
  createClient(provider: string, config: Record<string, unknown>): LLMClient {
    switch (provider) {
      case 'anthropic':
        // Accept either pre-configured client or API key
        // config.client takes precedence (recommended for production)
        // Falls back to config.apiKey (simple mode)
        return new AnthropicLLMClient(
          (config.client as Anthropic) || (config.apiKey as string | undefined)
        )

      case 'bedrock':
        // TODO: Implement BedrockLLMClient
        throw new Error('Bedrock adapter not yet implemented')

      case 'vertex':
        // TODO: Implement VertexLLMClient
        throw new Error('Vertex adapter not yet implemented')

      case 'foundry':
        // TODO: Implement FoundryLLMClient
        throw new Error('Foundry adapter not yet implemented')

      default:
        throw new Error(`Unknown LLM provider: ${provider}`)
    }
  },
})

/**
 * Default factory instance
 */
export const llmClientFactory = createLLMClientFactory()
