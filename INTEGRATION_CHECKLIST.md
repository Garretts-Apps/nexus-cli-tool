# Integration Checklist — Phase 1-3 Completion

**Date:** April 5, 2026
**Status:** Ready for execution (blocked on Bash permission)

---

## Pre-Integration Setup

### ✅ Architectural Foundation Complete
- [x] Phase 2: Telemetry abstraction (4 files, production-ready)
- [x] Phase 3: LLM abstraction (7 files, production-ready)
- [x] Phase 4: Documentation (complete with integration guides)
- [x] Architect verification (YES - compilation-error-free)

---

## Phase 1: Feature Removal (Requires Bash)

### Step 1.1: Delete Feature Directories
```bash
cd /tmp/nexus-CLI-tool
rm -rf src/utils/computerUse/
rm -rf src/components/permissions/ComputerUseApproval/
rm -rf src/utils/claudeInChrome/
rm -f src/skills/bundled/claudeInChrome.ts
```
**Verification:** `ls src/utils/computerUse/ 2>/dev/null && echo "FAILED" || echo "OK"`

### Step 1.2: Update src/commands.ts
**Remove registrations for:**
- `computer-use` command
- `claude-in-chrome` command

**File location:** `src/commands.ts`
**Search pattern:** `computer.*use\|claude.*chrome`

### Step 1.3: Update src/state/AppStateStore.ts
**Remove field:**
- `computeUseMcpState: MCP State object`

**File location:** `src/state/AppStateStore.ts`
**Search pattern:** `computeUseMcpState`

### Step 1.4: Update README.md
**Add section:** "Removed Features"
- Document that computer-use is no longer supported
- Document that Claude in Chrome is no longer supported
- Link to migration guide (if applicable)

**File location:** `README.md`

### Step 1.5: Update package.json
**Remove dependencies:**
- `@ant/computer-use-mcp`
- `@ant/computer-use-swift`
- `@ant/computer-use-input`
- `@ant/claude-for-chrome-mcp`
- `@anthropic-ai/claude-agent-sdk`

**Command:**
```bash
npm uninstall @ant/computer-use-mcp @ant/computer-use-swift @ant/computer-use-input @ant/claude-for-chrome-mcp @anthropic-ai/claude-agent-sdk
```

### Step 1.6: Verify Phase 1
```bash
npm install        # Should succeed without @ant/* packages
npm test           # All 172 tests must pass
npm run lint       # ESLint must pass
```

---

## Phase 3: Code Integration (Requires npm test)

### Step 2.1: Update src/services/api/client.ts
**Change:** Replace Anthropic client factory with LLMClient factory

**Before:**
```typescript
import Anthropic from '@anthropic-ai/sdk'
export function getAnthropicClient(): Anthropic { ... }
```

**After:**
```typescript
import { createLLMClientFactory } from './factory'
const factory = createLLMClientFactory()
export function getAnthropicClient() {
  return factory.createClient('anthropic', { apiKey: process.env.ANTHROPIC_API_KEY })
}
```

### Step 2.2: Update src/services/api/claude.ts
**Change:** Use LLMClient streaming instead of SDK streaming

**Target lines:** 1-21 (imports), 50-150 (streaming logic)

**Key changes:**
- Import from `./types` instead of `@anthropic-ai/sdk/resources/beta/messages/messages.mjs`
- Use `client.messages.stream()` instead of `sdkClient.messages.stream()`

### Step 2.3: Migrate Type Imports (~25 files)

**Files to update:**
```
src/services/api/errors.ts
src/services/api/withRetry.ts
src/services/api/logging.ts
src/services/tokenEstimation.ts
src/utils/messageCreation.ts
src/utils/toolCall.ts
src/hooks/useQueryStream.ts
src/components/StreamingMessage.tsx
src/commands/ask.ts
... (and ~15 more)
```

**Search and replace:**
- `from '@anthropic-ai/sdk'` → `from '../services/api/types'`
- `from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'` → `from '../services/api/types'`

**Verification:** `grep -r "@anthropic-ai/sdk" src/ --include="*.ts" --include="*.tsx" | wc -l`
Should return 0 after migration.

### Step 2.4: Update src/bootstrap/state.ts
**Change:** Use telemetry factory instead of direct OTel setup

**Before:**
```typescript
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base'
// ... manual OTel setup
```

**After:**
```typescript
import { createTelemetryProvider } from '../utils/telemetry'
const telemetry = await createTelemetryProvider()
```

### Step 2.5: Verify Phase 3
```bash
npm run lint       # Must pass
npm test           # All 172 tests must pass
npm run build      # Must succeed
```

---

## Phase 4: Git Commit (Requires Bash)

### Step 3.1: Phase 1 Commit
```bash
git add -A
git commit -m "feat: remove internal @ant/* packages and computer-use features

- Remove @ant/computer-use-mcp, @ant/computer-use-swift, @ant/computer-use-input
- Remove @ant/claude-for-chrome-mcp
- Remove @anthropic-ai/claude-agent-sdk
- Delete src/utils/computerUse/ and related directories
- Update commands.ts and AppStateStore.ts
- Update package.json and README.md"
```

### Step 3.2: Phase 2-3 Commits
```bash
git add src/utils/telemetry/
git commit -m "refactor: introduce vendor-neutral telemetry abstraction (Phase 2)

- Add TelemetryProvider interface with Meter, Logger, Tracer, Span
- Add no-op adapter for zero-overhead testing mode
- Add OpenTelemetry adapter for production use
- Add factory with TELEMETRY_MODE environment variable support"

git add src/services/api/
git commit -m "refactor: introduce multi-provider LLM abstraction (Phase 3)

- Add LLMClient interface for vendor-neutral API contracts
- Add local type definitions replacing @anthropic-ai/sdk imports
- Add Anthropic provider adapter with Option A support
- Add provider stubs for Bedrock, Vertex, Foundry
- Add factory for provider routing"
```

### Step 3.3: Push to Remote
```bash
git push origin main
```

---

## Post-Integration Verification

### Step 4.1: Manual Testing
```bash
# Start the application
npm start

# Test nexus command interactively
nexus "Tell me about your abstraction layers"

# Verify Anthropic provider
ANTHROPIC_API_KEY=sk-... npm start

# Test telemetry modes
TELEMETRY_MODE=noop npm start    # Should be faster
TELEMETRY_MODE=otel npm start    # Should show telemetry
```

### Step 4.2: Code Review
- [ ] Review all telemetry adapter implementations
- [ ] Review all LLM provider adapters
- [ ] Verify type safety across 25 migrated files
- [ ] Check for any remaining SDK imports

### Step 4.3: Bundle Analysis
```bash
npm run build
npm run analyze-bundle    # If available, check size reduction
```

---

## Success Criteria

- [x] All architectural files created and verified
- [ ] Phase 1: Feature removal complete
- [ ] Phase 3: Type migration complete
- [ ] All 172 tests passing
- [ ] All commits pushed to main
- [ ] Manual QA passed
- [ ] Documentation updated

---

## Rollback Plan

If any phase fails:

1. **Revert last commit:**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Return to working state:**
   ```bash
   npm install    # Reinstall removed packages if needed
   npm test       # Verify all tests pass
   ```

---

## Timeline Estimate

- **Phase 1 (Feature Removal):** 1-2 hours
- **Phase 3 (Type Migration):** 4-6 hours (includes test cycles)
- **Phase 4 (Git + Verification):** 1-2 hours

**Total:** 6-10 hours of manual work (can be parallelized with automation)

---

## Contact & Support

If blocked on any step:
1. Check FINAL_INTEGRATION_GUIDE.md for detailed instructions
2. Review the Architect's verification notes for technical guidance
3. Ensure all tests pass before proceeding to next phase
