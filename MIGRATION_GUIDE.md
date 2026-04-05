# Type Migration Guide — From @anthropic-ai/sdk to Local Types

**Purpose:** This guide provides exact code changes for migrating 25+ files from SDK imports to the new local type definitions in `src/services/api/types.ts`.

**Status:** This guide documents all necessary changes. Execute in order after Phase 1 completion.

---

## Overview

**Current State:**
- 123+ files import from `@anthropic-ai/sdk`
- 29 files import from `@anthropic-ai/sdk/resources/beta/messages/messages.mjs`
- Types are tightly coupled to SDK

**Target State:**
- All files import from `src/services/api/types.ts` (or `./types` for same-directory)
- All Beta API types available locally
- SDK is isolated to adapters only

**Testing Strategy:**
- Migrate one file at a time
- Run `npm test` after every 3-5 files
- Stop and debug if any test fails

---

## File-by-File Migration

### Group 1: Core API Files (Test after each)

#### 1. `src/services/api/claude.ts`

**Current imports (lines 1-21):**
```typescript
import {
  BetaContentBlock,
  BetaContentBlockParam,
  BetaImageBlockParam,
  BetaJSONOutputFormat,
  BetaMessage,
  BetaMessageDeltaUsage,
  BetaMessageStreamParams,
  BetaOutputConfig,
  BetaRawMessageStreamEvent,
  BetaRequestDocumentBlock,
  BetaStopReason,
  BetaToolChoiceAuto,
  BetaToolChoiceTool,
  BetaToolResultBlockParam,
  BetaToolUnion,
  TextBlockParam,
  BetaMessageParam as MessageParam,
  BetaUsage
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
```

**Replace with:**
```typescript
import type {
  BetaContentBlock,
  BetaContentBlockParam,
  BetaImageBlockParam,
  BetaJSONOutputFormat,
  BetaMessage,
  BetaMessageDeltaUsage,
  BetaMessageStreamParams,
  BetaOutputConfig,
  BetaRawMessageStreamEvent,
  BetaRequestDocumentBlock,
  BetaStopReason,
  BetaToolChoiceAuto,
  BetaToolChoiceTool,
  BetaToolResultBlockParam,
  BetaToolUnion,
  TextBlockParam,
  BetaMessageParam as MessageParam,
  BetaUsage
} from './types'
```

**Changes:**
- Line 1: Change path from `@anthropic-ai/sdk/resources/beta/messages/messages.mjs` to `./types`
- Add `type` keyword (all are type imports, not runtime)

**Verify:** `npm test -- claude.test.ts` (should pass)

#### 2. `src/services/api/errors.ts`

**Current imports (lines 1-5):**
```typescript
import { APIError, APIConnectionError, APIConnectionTimeoutError } from '@anthropic-ai/sdk'
```

**Replace with:**
```typescript
import { APIError, APIConnectionError, APIConnectionTimeoutError } from './types'
```

**Changes:**
- Change path from `@anthropic-ai/sdk` to `./types`
- No other changes needed (class names are identical)

**Verify:** `npm test -- errors.test.ts`

#### 3. `src/services/api/withRetry.ts`

**Find all imports from SDK:**
```bash
grep "@anthropic-ai/sdk" src/services/api/withRetry.ts
```

**Likely imports:**
- `APIError`, `RateLimitError`, `APIConnectionError`

**Replace with:**
```typescript
import { APIError, RateLimitError, APIConnectionError } from './types'
```

**Changes:**
- Update import path
- Error instanceof checks remain unchanged (same class names)

**Verify:** `npm test -- withRetry.test.ts`

---

### Group 2: Service Files (Test after each)

#### 4. `src/services/api/logging.ts`

**Current imports:**
```typescript
import { BetaUsage } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
```

**Replace with:**
```typescript
import type { BetaUsage } from './types'
```

**Verify:** `npm test -- logging.test.ts`

#### 5. `src/services/tokenEstimation.ts`

**Current imports:**
```typescript
import { BetaMessage, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
```

**Replace with:**
```typescript
import type { BetaMessage, BetaMessageParam } from '../services/api/types'
```

**Note:** Path is `../services/api/types` because this file is in `src/utils/`

**Verify:** `npm test -- tokenEstimation.test.ts`

#### 6. `src/services/messageCreation.ts`

**Current imports:**
```typescript
import { ContentBlock, Message } from '@anthropic-ai/sdk'
```

**Replace with:**
```typescript
import type { ContentBlock, Message } from '../services/api/types'
```

**Verify:** `npm test -- messageCreation.test.ts`

---

### Group 3: Utility Files (Test every 2-3 files)

#### 7-9. Utility files importing message types

**Files to check:**
- `src/utils/toolCall.ts`
- `src/utils/errorUtils.ts`
- `src/utils/messageHandling.ts`

**Pattern to find:**
```bash
grep -n "from '@anthropic-ai/sdk" src/utils/*.ts
```

**Replace all imports:**
```typescript
// Change this:
import { ContentBlock, Message, ... } from '@anthropic-ai/sdk'

// To this:
import type { ContentBlock, Message, ... } from '../services/api/types'
```

**Key error types to migrate:**
- `APIError` → `from '../services/api/types'`
- `RateLimitError` → `from '../services/api/types'`
- `APIConnectionError` → `from '../services/api/types'`

---

### Group 4: Component Files (Test after Group 3)

#### 10-15. React component files

**Find all imports:**
```bash
grep -rn "@anthropic-ai/sdk" src/components/ --include="*.tsx"
```

**Pattern: Message and ContentBlock types**
```typescript
// Before:
import { Message, ContentBlock } from '@anthropic-ai/sdk'

// After:
import type { Message, ContentBlock } from '../../services/api/types'
```

**Common components:**
- `StreamingMessage.tsx`
- `MessageDisplay.tsx`
- `ToolOutput.tsx`

---

### Group 5: Hook Files

#### 16-18. React hooks

**Files to check:**
```bash
grep -rn "@anthropic-ai/sdk" src/hooks/ --include="*.ts"
```

**Replace imports:**
```typescript
import type { Message, Stream } from '../../services/api/types'
```

---

### Group 6: Command Files

#### 19-25. CLI command files

**Find command files:**
```bash
find src/commands/ -name "*.ts" | xargs grep -l "@anthropic-ai/sdk"
```

**Replace imports in each:**
```typescript
import type { Message, BetaMessage } from '../../services/api/types'
```

---

## Post-Migration Verification

### Step 1: Verify no SDK imports remain

```bash
# Should return 0 results
grep -r "from '@anthropic-ai/sdk'" src/ --include="*.ts" --include="*.tsx" | wc -l

# Should also return 0
grep -r "from '@anthropic-ai/sdk/resources" src/ --include="*.ts" --include="*.tsx" | wc -l
```

### Step 2: Run full test suite

```bash
npm test

# All 172 tests must pass
# If any fail, check the error message and revert that file
```

### Step 3: Type check

```bash
npx tsc --noEmit

# No type errors should be reported
# If errors exist, they indicate incomplete Beta type aliases
```

### Step 4: Build check

```bash
npm run build

# Build must succeed
# Check for any warnings about missing types
```

---

## Troubleshooting

### "Cannot find module '@anthropic-ai/sdk'"

**Cause:** File was not fully migrated or has nested imports.

**Fix:**
```bash
# Find the problematic file
grep -rn "@anthropic-ai/sdk" src/ --include="*.ts"

# Edit that specific file and update imports
```

### "Type 'X' is not exported from './types'"

**Cause:** A Beta API type is missing from `src/services/api/types.ts`.

**Fix:**
1. Note which type is missing
2. Add it to types.ts (with other Beta types)
3. Rebuild
4. Rerun test

### "Test Y is failing after migration"

**Cause:** Type mismatch between local type and SDK type in test setup.

**Fix:**
1. Check the test file for SDK imports
2. Update test imports to use local types
3. Update test data/mocks if needed
4. Rerun test

---

## Rollback Procedure

If migration causes widespread test failures:

```bash
# Revert all changes in one group
git checkout -- src/services/

# Fix the underlying issue (usually missing type alias)
# Edit src/services/api/types.ts

# Re-apply migrations one file at a time
```

---

## Migration Tracking

Use this checklist to track progress:

- [ ] Group 1: Core API (claude.ts, errors.ts, withRetry.ts)
- [ ] Group 2: Services (logging.ts, tokenEstimation.ts, messageCreation.ts)
- [ ] Group 3: Utilities (toolCall.ts, errorUtils.ts, etc.)
- [ ] Group 4: Components (StreamingMessage.tsx, etc.)
- [ ] Group 5: Hooks (useStream.ts, useMessage.ts, etc.)
- [ ] Group 6: Commands (ask.ts, chat.ts, etc.)
- [ ] Verification: No @anthropic-ai/sdk imports remain
- [ ] Verification: All 172 tests pass
- [ ] Verification: TypeScript compiles cleanly
- [ ] Verification: Build succeeds

---

## Timeline

**Estimated effort:** 4-6 hours

- **Group 1:** 30 mins (most critical)
- **Group 2:** 1 hour (service layer)
- **Group 3:** 1 hour (utilities)
- **Group 4:** 1 hour (components)
- **Group 5:** 30 mins (hooks)
- **Group 6:** 1 hour (commands)
- **Testing & cleanup:** 30 mins

**Parallelization:** Groups 3-6 can be done in parallel by different developers

---

## Success Criteria

✅ All migrations complete when:
1. No files import from `@anthropic-ai/sdk` (except adapters)
2. All 172 tests pass
3. TypeScript compiles without errors
4. Bundle size reduced by ~10-15MB
5. All imports use relative paths: `from '../services/api/types'` or `from './types'`
