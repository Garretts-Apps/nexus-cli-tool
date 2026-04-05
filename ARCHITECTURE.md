# Nexus CLI — Architecture Guide

## Overview

Nexus CLI is a vendor-neutral, multi-provider terminal-based development assistant. This document explains the core architectural patterns and abstractions.

## Core Architecture

### 1. Vendor-Neutral Abstraction Layers

#### Telemetry Layer (`src/utils/telemetry/`)

The telemetry system is abstracted behind a vendor-neutral interface, allowing swappable implementations:

```
┌─────────────────────────────────────────┐
│   Application Code (uses TelemetryProvider)
└────────────┬────────────────────────────┘
             │
        ┌────▼────────────────────┐
        │  Factory (index.ts)      │
        │  - Selects implementation│
        │  - env: TELEMETRY_MODE   │
        └────┬──────────────────┬──┘
             │                  │
        ┌────▼──────┐    ┌──────▼────────┐
        │ OTel Mode │    │ No-Op Mode    │
        │(production)   │(performance)   │
        └───────────┘    └───────────────┘
```

**Implementations:**
- **OTel Adapter** (`otel-adapter.ts`): Full OpenTelemetry instrumentation
- **No-Op Adapter** (`no-op-adapter.ts`): Zero-overhead for testing

**Selection:**
```bash
# Production (default)
TELEMETRY_MODE=otel npm start

# Performance testing (zero overhead)
TELEMETRY_MODE=noop npm start
```

#### LLM Client Layer (`src/services/api/`)

The LLM client abstraction enables multi-provider support:

```
┌──────────────────────────────────────────┐
│  Application Code (uses LLMClient)        │
└────────────┬─────────────────────────────┘
             │
        ┌────▼─────────────┐
        │  Factory          │
        │  (factory.ts)     │
        └────┬──────┬──────┬──┐
             │      │      │  │
        ┌────▼───┐ ┌─▼──┐ ┌─▼──┐ ┌──▼──┐
        │Anthropic│ │AWS │ │GCP │ │Custom
        │(Claude) │ │Bedrock
        │         │ │Vertex│ │  │
        └─────────┘ └────┘ └───┘ └──┘
```

**Provider Adapters:**
- `anthropic-adapter.ts` - Wraps @anthropic-ai/sdk
- `bedrock-adapter.ts` - Wraps AWS Bedrock (TODO)
- `vertex-adapter.ts` - Wraps Google Vertex AI (TODO)
- `foundry-adapter.ts` - Wraps Anthropic Foundry (TODO)

**Key Interfaces:**
- `LLMClient` - Main client interface
- `MessageRequest` - Standardized request format
- `StreamEvent` - Streaming event types
- `Message` - Response message format

## State Management

### Two-Tier State Architecture

1. **Bootstrap State** (`src/bootstrap/state.ts`)
   - Module-level singleton
   - Process-global configuration
   - Session identity, telemetry providers, CWD
   - Accessed via getter/setter functions
   - No circular dependencies

2. **AppState** (`src/state/AppStateStore.ts`)
   - React-scoped state
   - Immutable (enforced by TypeScript)
   - Provided via React context
   - Subscribed to via `useSyncExternalStore`

### State Flow

```
User Input
    ↓
React Component (useSyncExternalStore)
    ↓
setState() → AppStateStore
    ↓
onChange() callback
    ↓
Side effects (git operations, file I/O, etc.)
```

## Message Flow

```
User Message
    ↓
REPL Component (screens/REPL.tsx)
    ↓
Query Engine (query.ts)
    ├─ Build system prompt
    ├─ Normalize messages
    ├─ Attach context
    ↓
LLMClient.stream(params)
    ├─ Actual API call via provider adapter
    ├─ Stream events
    ↓
Tool Orchestration Loop
    ├─ Identify tool_use blocks
    ├─ Check permissions
    ├─ Execute tool
    ├─ Get ToolResult
    ├─ Loop back to API
    ↓
AppState updates → React re-renders
    ↓
Terminal output
```

## Tool System

Tools are plugins that extend Nexus functionality:

```
src/tools/
├── ReadTool/
├── WriteTool/
├── EditTool/
├── BashTool/
├── GlobTool/
├── GrepTool/
└── [40+ other tools]
```

Each tool:
1. Receives `ToolUseContext` (config, app state, permissions)
2. Returns `ToolResultBlockParam`
3. Can request permission via permission system
4. Can render JSX output

## Command System

Commands are slash-commands (e.g., `/commit`, `/pr-create`):

```
src/commands/
├── commit.ts
├── pr-create.ts
├── plan.ts
└── [100+ commands]
```

Commands:
1. Are registered in `src/commands.ts`
2. Can be gated by feature flags
3. Return content blocks or JSX
4. Have full access to tools and state

## Terminal UI (Ink)

Uses a **forked version of React Ink** (`src/ink/`) with custom features:

- Click events and hit testing
- Terminal focus tracking
- Virtual scrolling for large lists
- Bidirectional text support
- ANSI rendering optimization

## Configuration System

Three levels of configuration:

1. **Global** (`~/.clauderc`) - User preferences
2. **Project** (`.claude/CLAUDE.md`) - Project-specific settings
3. **Runtime** (Environment variables) - Overrides

## Extensibility

### Adding a New Provider

1. Create adapter: `src/services/api/{provider}-adapter.ts`
2. Implement `LLMClient` interface
3. Update factory: `src/services/api/factory.ts`
4. Add tests
5. Update documentation

### Adding a New Tool

1. Create directory: `src/tools/{ToolName}/`
2. Implement Tool interface
3. Register in `src/tools.ts`
4. Add tests
5. Optional: gate behind feature flag

## Performance Considerations

1. **Lazy Loading**: Commands and tools loaded on demand
2. **Code Splitting**: Features split for parallel loading
3. **State Batching**: Updates batched with render frames
4. **Telemetry Abstraction**: Can be disabled for testing (no-op mode)
5. **Memoization**: React components memoized to prevent unnecessary re-renders

## Error Handling

Unified error handling:

- `APIError` - API-level errors (from LLM providers)
- `APIUserAbortError` - User cancellation
- `RateLimitError` - Rate limiting
- `AuthenticationError` - Auth failures

Errors are:
1. Caught at tool level
2. Translated to provider-neutral format
3. Logged and displayed to user
4. Retried with backoff where appropriate

---

## See Also

- `PROVIDERS.md` - Guide for adding new LLM providers
- `SETUP.md` - Installation and configuration
- `README.md` - Feature overview
