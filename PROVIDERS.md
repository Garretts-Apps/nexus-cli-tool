# Adding New LLM Providers to Nexus CLI

This guide explains how to add support for new LLM providers (OpenAI, Cohere, Llama, etc.) to Nexus CLI.

## Architecture

Nexus CLI uses an **adapter pattern** to support multiple LLM providers:

```
┌─────────────────────┐
│  Application Code    │
└──────────┬──────────┘
           │
    ┌──────▼──────┐
    │   Factory   │
    └──────┬──────┘
           │
    ┌──────┴──────────────────┐
    │                         │
 ┌──▼──┐  ┌──────┐  ┌──────┐
 │Claude│  │OpenAI│  │Cohere│
 └──────┘  └──────┘  └──────┘
```

Each provider implements the `LLMClient` interface, which is completely vendor-neutral.

## Step 1: Create the Adapter File

Create `src/services/api/{provider}-adapter.ts`:

```typescript
/**
 * {Provider Name} adapter
 *
 * Wraps the {provider SDK} and implements the LLMClient interface
 */

import type { LLMClient, Message, MessageRequest, Stream, StreamEvent } from './interface'
import { APIError } from './types'

export class {ProviderName}LLMClient implements LLMClient {
  messages = {
    create: (params: MessageRequest): Promise<Message> => this.create(params),
    stream: (params: MessageRequest): Stream<StreamEvent> => this.stream(params),
  }

  constructor(apiKey?: string) {
    // Initialize provider SDK
  }

  private async create(params: MessageRequest): Promise<Message> {
    // Implement non-streaming message creation
    // 1. Call provider SDK
    // 2. Translate response to our Message type
    // 3. Handle errors
  }

  private stream(params: MessageRequest): Stream<StreamEvent> {
    // Implement streaming
    // 1. Call provider SDK stream
    // 2. Translate events to our StreamEvent type
    // 3. Wrap in Stream class
  }

  private translateMessage(response: any): Message {
    // Translate provider-specific message to our Message type
    return {
      id: response.id,
      type: 'message',
      role: 'assistant',
      content: response.content,
      model: response.model,
      stop_reason: response.stop_reason,
      stop_sequence: response.stop_sequence ?? null,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    }
  }

  private translateError(error: unknown): Error {
    // Translate provider-specific errors to our error types
    if (error instanceof Error && error.message.includes('rate limit')) {
      return new APIError(error.message, 429, 'rate_limit_error')
    }
    return error as Error
  }
}
```

## Step 2: Update the Factory

Edit `src/services/api/factory.ts`:

```typescript
import { {ProviderName}LLMClient } from './{provider}-adapter'

export const createLLMClientFactory = (): LLMClientFactory => ({
  createClient(provider: string, config: Record<string, unknown>): LLMClient {
    switch (provider) {
      case 'anthropic':
        return new AnthropicLLMClient(config.apiKey as string | undefined)

      case '{provider}':                              // Add this
        return new {ProviderName}LLMClient(           // Add this
          config.apiKey as string | undefined
        )

      default:
        throw new Error(`Unknown LLM provider: ${provider}`)
    }
  },
})
```

## Step 3: Create Unit Tests

Create `src/services/api/__tests__/{provider}.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { {ProviderName}LLMClient } from '../{provider}-adapter'

describe('{Provider Name} Adapter', () => {
  let client: {ProviderName}LLMClient

  beforeEach(() => {
    client = new {ProviderName}LLMClient('test-key')
  })

  it('should create a message', async () => {
    const response = await client.messages.create({
      model: '{provider-model-name}',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(response.id).toBeDefined()
    expect(response.type).toBe('message')
    expect(response.role).toBe('assistant')
  })

  it('should stream messages', async () => {
    const stream = client.messages.stream({
      model: '{provider-model-name}',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }],
    })

    let eventCount = 0
    for await (const event of stream) {
      eventCount++
      expect(event.type).toBeDefined()
    }
    expect(eventCount).toBeGreaterThan(0)
  })

  it('should handle API errors', async () => {
    // Test error handling
  })
})
```

## Step 4: Configuration

Document provider-specific configuration in your adapter:

```typescript
/**
 * Configuration for {Provider Name}
 *
 * Environment variables:
 * - {PROVIDER}_API_KEY: API key for authentication
 * - {PROVIDER}_MODEL: Default model (e.g., 'gpt-4')
 *
 * Usage:
 * const client = new {ProviderName}LLMClient(apiKey)
 * const message = await client.messages.create({
 *   model: 'gpt-4',
 *   messages: [...],
 *   max_tokens: 1000,
 * })
 */
```

## Step 5: Update Documentation

1. Add to `ARCHITECTURE.md` providers section
2. Update `SETUP.md` with configuration instructions
3. Add to `README.md` supported providers list

## Type Translation Guide

When translating between provider APIs and our interface:

### Request Translation
```typescript
// Input (our interface)
const request: MessageRequest = {
  model: 'claude-3-sonnet',
  max_tokens: 1000,
  system: 'You are helpful',
  tools: [...],
  messages: [{ role: 'user', content: 'Hello' }],
}

// Output (provider-specific)
const providerRequest = {
  model: 'claude-3-sonnet',
  max_tokens: 1000,
  system: 'You are helpful',
  tools: request.tools.map(translateTool),
  messages: request.messages.map(translateMessage),
}
```

### Response Translation
```typescript
// Input (provider response)
const providerResponse = {
  id: 'msg_123',
  content: [{ type: 'text', text: 'Hello!' }],
  usage: { input_tokens: 10, output_tokens: 5 },
}

// Output (our interface)
const message: Message = {
  id: providerResponse.id,
  type: 'message',
  role: 'assistant',
  content: providerResponse.content,
  model: request.model,
  stop_reason: providerResponse.stop_reason ?? null,
  stop_sequence: null,
  usage: providerResponse.usage,
}
```

## Example: OpenAI Provider

Here's a complete example for OpenAI:

```typescript
import OpenAI from 'openai'
import type { LLMClient, Message, MessageRequest, Stream, StreamEvent } from './interface'

export class OpenAILLMClient implements LLMClient {
  messages = {
    create: (params: MessageRequest): Promise<Message> => this.create(params),
    stream: (params: MessageRequest): Stream<StreamEvent> => this.stream(params),
  }

  private client: OpenAI

  constructor(apiKey?: string) {
    this.client = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY })
  }

  private async create(params: MessageRequest): Promise<Message> {
    const response = await this.client.chat.completions.create({
      model: params.model,
      max_tokens: params.max_tokens,
      system: params.system as string,
      messages: params.messages.map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : m.content,
      })),
      temperature: params.temperature,
      top_p: params.top_p,
    })

    return {
      id: response.id,
      type: 'message',
      role: 'assistant',
      content: response.choices[0].message.content as any,
      model: params.model,
      stop_reason: response.choices[0].finish_reason === 'stop' ? 'stop_sequence' : null,
      stop_sequence: null,
      usage: {
        input_tokens: response.usage?.prompt_tokens ?? 0,
        output_tokens: response.usage?.completion_tokens ?? 0,
      },
    }
  }

  private stream(params: MessageRequest): Stream<StreamEvent> {
    // Implement streaming...
  }
}
```

## Common Pitfalls

1. **Not handling streaming correctly** - Ensure delta events are translated properly
2. **Ignoring error codes** - Map provider errors to our standard error types
3. **Missing tool support** - Ensure tools/function_calling works if supported
4. **Type mismatches** - Be careful with message content types (string vs blocks)
5. **Missing shutdown** - Implement proper resource cleanup in Stream

## Testing Your Provider

```bash
# Run adapter tests
npm test -- {provider}.test.ts

# Test in interactive mode
NEXUS_PROVIDER=openai npm start
```

## Submitting Your Provider

1. Ensure all tests pass
2. Add documentation
3. Create a pull request
4. Request review from maintainers

---

## Reference

- `interface.ts` - Core interfaces and types
- `types.ts` - Type definitions and error classes
- `anthropic-adapter.ts` - Reference implementation
- `ARCHITECTURE.md` - System architecture
