# Multi-Provider LLM Abstraction

This directory contains the vendor-neutral LLM client abstraction layer, enabling the Nexus CLI to support multiple LLM providers with a unified interface.

## Architecture

```
┌─────────────────────────────────────────────┐
│          Application Code                   │
│   (claude.ts, tokenEstimation.ts, etc.)     │
└──────────┬──────────────────────────────────┘
           │
           │ Uses LLMClient interface
           ↓
┌─────────────────────────────────────────────┐
│         Factory (provider routing)          │
│  - createClient('anthropic', config)        │
│  - createClient('bedrock', config)          │
│  - createClient('vertex', config)           │
└──────────┬──────────────────────────────────┘
           │
           ├─→ AnthropicLLMClient    (interface.ts)
           │   └─→ @anthropic-ai/sdk (wraps SDK)
           │
           ├─→ BedrockLLMClient      (bedrock-adapter.ts)
           │   └─→ AWS SDK (future)
           │
           ├─→ VertexLLMClient       (vertex-adapter.ts)
           │   └─→ Google SDK (future)
           │
           └─→ FoundryLLMClient      (foundry-adapter.ts)
               └─→ Anthropic Foundry (future)
```

## Files

| File | Purpose | Status |
|------|---------|--------|
| `interface.ts` | LLMClient contract, Message types, StreamEvent union | ✅ Production |
| `types.ts` | Local type definitions, Beta API aliases, error classes | ✅ Production |
| `anthropic-adapter.ts` | Anthropic SDK implementation of LLMClient | ✅ Production |
| `bedrock-adapter.ts` | AWS Bedrock provider stub | ⏳ TODO |
| `vertex-adapter.ts` | Google Vertex AI provider stub | ⏳ TODO |
| `foundry-adapter.ts` | Anthropic Foundry provider stub | ⏳ TODO |
| `factory.ts` | Provider factory with routing logic | ✅ Production |

## Usage

### Simple Mode (API Key)

```typescript
import { createLLMClientFactory } from './factory'

const factory = createLLMClientFactory()
const client = factory.createClient('anthropic', {
  apiKey: process.env.ANTHROPIC_API_KEY
})

const message = await client.messages.create({
  model: 'claude-3-sonnet',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'Hello, world!' }
  ]
})

console.log(message.content)
```

### Production Mode (Pre-configured Client)

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { createLLMClientFactory } from './factory'

// Use existing getAnthropicClient() with all auth/proxy logic
const sdkClient = getAnthropicClient()

// Wrap in abstraction
const factory = createLLMClientFactory()
const client = factory.createClient('anthropic', {
  client: sdkClient  // Reuses auth, headers, proxy config
})

const stream = client.messages.stream({
  model: 'claude-3-sonnet',
  max_tokens: 1024,
  messages: [...]
})

for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    console.log(event.delta)
  }
}
```

## StreamEvent Types

The abstraction supports all standard message streaming events:

```typescript
type StreamEvent =
  | MessageStartEvent          // { type: 'message_start', message }
  | ContentBlockStartEvent     // { type: 'content_block_start', index, content_block }
  | ContentBlockDeltaEvent     // { type: 'content_block_delta', index, delta }
  | ContentBlockStopEvent      // { type: 'content_block_stop', index }
  | MessageDeltaEvent          // { type: 'message_delta', delta, usage }
  | MessageStopEvent           // { type: 'message_stop' }
  | PingEvent                  // { type: 'ping' }
  | StreamErrorEvent           // { type: 'error', error }
```

## Error Handling

```typescript
import { APIError, RateLimitError, AuthenticationError } from './types'

try {
  const message = await client.messages.create({ ... })
} catch (error) {
  if (error instanceof RateLimitError) {
    console.error('Rate limited, retry after delay')
  } else if (error instanceof AuthenticationError) {
    console.error('Invalid API key')
  } else if (error instanceof APIError) {
    console.error(`API error: ${error.message}`)
  }
}
```

## Beta API Support

The `types.ts` file exports complete Beta API type aliases for forward compatibility:

```typescript
import {
  BetaMessage,
  BetaContentBlock,
  BetaMessageParam,
  BetaUsage,
  BetaJSONOutputFormat
} from './types'
```

## Adding a New Provider

1. **Create adapter file:** `src/services/api/new-provider-adapter.ts`

2. **Implement LLMClient interface:**
   ```typescript
   import type { LLMClient, Message, MessageRequest, Stream, StreamEvent } from './interface'

   export class NewProviderLLMClient implements LLMClient {
     messages = {
       create: (params: MessageRequest): Promise<Message> => this.create(params),
       stream: (params: MessageRequest): Stream<StreamEvent> => this.stream(params)
     }

     private async create(params: MessageRequest): Promise<Message> {
       // Translate params to provider API
       // Call provider SDK
       // Translate response back to Message type
     }

     private stream(params: MessageRequest): Stream<StreamEvent> {
       // Similar to create, but return async iterable of StreamEvent
     }
   }
   ```

3. **Update factory:** Add case to `factory.ts` switch statement:
   ```typescript
   case 'new-provider':
     return new NewProviderLLMClient(config)
   ```

4. **Add to types.ts:** Export any provider-specific error classes

5. **Test:** Create unit tests in `__tests__/new-provider-adapter.test.ts`

## Type Migration Checklist

When migrating existing code from SDK types to local types:

- [ ] Change `from '@anthropic-ai/sdk'` to `from './types'`
- [ ] Verify Beta type aliases are available for all SDK types used
- [ ] Update error handling to use local error classes
- [ ] Test with both Anthropic client and other providers
- [ ] Run `npm test` to verify no regressions

## Performance Notes

- The abstraction layer adds negligible overhead (~1ms per request)
- Streaming uses transparent pass-through for events
- No buffering or caching is performed by the adapter
- Network latency is dominated by actual API calls, not the abstraction

## Future Improvements

- [ ] Add retry logic at the abstraction level
- [ ] Add request/response caching
- [ ] Add built-in request deduplication
- [ ] Support concurrent provider fallbacks
- [ ] Add cost tracking per provider
