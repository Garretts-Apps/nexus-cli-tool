# Architecture: Global State Management

## Overview

Global state is organized into four tiers based on lifecycle, mutability, and
domain ownership. Each tier lives in a dedicated module under `src/state/` or
`src/bootstrap/`. The `bootstrap/state.ts` module is the original monolith,
now slimmed to Tier 1 process invariants plus backward-compatible re-exports.

## Tier-Based State Organization

### Tier 1 -- Process Invariants (`src/bootstrap/state.ts`)

Process-lifetime constants set once at startup, never modified after
initialization:

| Field | Description |
|-------|-------------|
| `sessionId` | Unique session identifier (UUID) |
| `originalCwd` | Working directory at startup (symlink-resolved) |
| `projectRoot` | Stable project root (set by `--worktree` flag at startup) |
| `startTime` | Session start timestamp (`Date.now()`) |
| `isInteractive` | Whether the session is interactive or headless |
| `cwd` | Current working directory (updated by `setCwdState`) |

`bootstrap/state.ts` also hosts session lifecycle functions (`switchSession`,
`regenerateSessionId`) and the test-only `resetStateForTests()` that
coordinates resets across all tiers.

### Tier 2 -- Session Configuration (`src/state/sessionConfig.ts`)

Configuration loaded from settings, user input, CLI flags. Set during
initialization, read throughout the session:

- **Model settings:** `modelUsage`, `mainLoopModelOverride`, `initialMainLoopModel`, `modelStrings`
- **Client config:** `clientType`, `sessionSource`, `questionPreviewFormat`
- **Settings:** `flagSettingsPath`, `flagSettingsInline`, `allowedSettingSources`
- **Credentials:** `sessionIngressToken`, `oauthTokenFromFd`, `apiKeyFromFd`
- **API provider:** `apiProvider`, `apiProviderConfig`, `apiProviderConfigured`
- **SDK:** `sdkAgentProgressSummariesEnabled`, `kairosActive`, `strictToolResultPairing`, `userMsgOptIn`, `sdkBetas`
- **Channels:** `allowedChannels`, `hasDevChannels`, `sessionProjectDir`, `mainThreadAgentType`, `isRemoteMode`

### Tier 3 -- Volatile Runtime (session-lifetime reactive state)

State that changes throughout a session in response to API calls, user
actions, and system events:

| Module | Description |
|--------|-------------|
| `src/state/metrics.ts` | Cost, duration, line counts, token usage, turn counters |
| `src/state/telemetryProviders.ts` | OpenTelemetry providers, meters, loggers, counters |
| `src/state/promptCacheLatches.ts` | Cache header latches for streaming optimization |

### Tier 4 -- Auxiliary Domain State (`src/state/*`)

Domain-specific isolated modules, each owning a narrow concern:

| Module | Description |
|--------|-------------|
| `src/state/cronState.ts` | Scheduled task / cron session tracking |
| `src/state/teamState.ts` | Team creation tracking |
| `src/state/skillState.ts` | Invoked skill tracking |
| `src/state/pluginState.ts` | Plugin configuration state |
| `src/state/scrollDrain.ts` | Terminal scroll state management |
| `src/state/apiDebug.ts` | API request debugging state |

## Architectural Constraints

1. **bootstrap/state.ts is a DAG leaf:** It only imports from `src/state/*`
   modules (with justified `eslint-disable` comments) for test reset
   coordination. It is never imported by `src/state/*` modules.

2. **No circular dependencies:** All state modules form an acyclic graph.
   `src/state/*` modules do not import from `bootstrap/state.ts`.

3. **Direct imports:** Consumers import directly from the relevant
   `src/state/*` module (e.g., `import { getModelUsage } from
   'src/state/sessionConfig.js'`). The re-export layer in
   `bootstrap/state.ts` was removed in Phase 5 -- all 102 consumers were
   migrated to direct imports.

4. **ESLint enforcement:** The `custom-rules/bootstrap-isolation` rule
   prevents `bootstrap/state.ts` from importing `src/state/*` without an
   explicit disable comment. Run `npm run lint:arch` to verify.

5. **Each module owns its reset:** Every `src/state/*` module exports a
   `reset*State()` function. `bootstrap/state.ts` calls these in
   `resetStateForTests()` for test isolation.

## Migration Path for New State

1. **Is it immutable after startup?** --> Tier 1 (`bootstrap/state.ts`)
2. **Is it configuration from settings/flags?** --> Tier 2 (`sessionConfig.ts`)
3. **Is it session-lifetime reactive?** --> Tier 3 (create `src/state/<name>.ts`)
4. **Is it domain-specific and isolated?** --> Tier 4 (create `src/state/<name>.ts`)

When adding a new Tier 3/4 module:

1. Create `src/state/<name>.ts` with getters, setters, and a `reset<Name>State()` function.
2. Import the reset function in `bootstrap/state.ts` (with `eslint-disable-next-line`).
3. Call the reset function inside `resetStateForTests()`.
4. Have consumers import directly from `src/state/<name>.js`.

## Verification

```bash
# Check bootstrap isolation (0 errors = clean)
npm run lint:arch

# Run full lint (may show upstream noise from other disabled rules)
npm run lint

# Run tests
npm test
```

## ARCH-002 Phase History

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Extract Tier 4 auxiliary state (cron, team, skill, plugin, scrollDrain) | Complete |
| Phase 2 | Extract telemetry and metrics state | Complete |
| Phase 3 | Extract prompt cache latches and API debug state | Complete |
| Phase 4 | Extract session config state to sessionConfig.ts | Complete |
| Phase 5 | Migrate 102 consumers to direct imports, remove re-exports | Complete |
| Phase 6 | ESLint bootstrap-isolation rule + architecture documentation | Complete |
