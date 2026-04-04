# Nexus CLI Implementation Framework
## Complete Guide for Remaining 18 Fixes

**Status:** 9/27 complete (33%) | Ready for systematic completion
**Framework Version:** 1.0
**Last Updated:** 2026-04-04

---

## Quick Reference: Fix Implementation Checklist

### TIER 1: Quick Wins (Complete in 1-2 days each)

- [ ] **SEC-010** (8h) - MCP Tool Description Injection
- [ ] **SEC-014** (4h) - Dependency Vulnerability Audit
- [ ] **SEC-015** (6h) - /proc/environ Credentials Leak
- [ ] **SEC-016** (2h) - Pre-signed URL Cache Hashing
- [ ] **CODE-003** (3h) - Remove Testing Seams
- [ ] **CODE-007** (6h) - Silent Error Swallowing
- [ ] **PERF-005** (8h) - Merge Filter/Map Chains
- [ ] **PERF-004** (12h) - Incremental Map/Set Rebuilding

**Subtotal:** 49 hours (~1 week, 2 developers)

### TIER 2: Architecture (Complete after test foundation)

- [ ] **ARCH-003** (80h) - Vitest Test Suite [PREREQUISITE]
- [ ] **ARCH-001** (80h) - Decompose God Files
- [ ] **ARCH-002** (80h) - Reduce Global State
- [ ] **ARCH-004** (40h) - Resolve Circular Imports

**Subtotal:** 280 hours (~7 weeks, 1 developer)

### TIER 3: Backlog/Optional

- [ ] **SEC-004** (40h) - BashTool Rate Limiting
- [ ] **CODE-001** (20h) - Reduce REPL Complexity
- [ ] **CODE-006** (8h) - Consolidate TODOs
- [ ] **PERF-008** (8h) - Reduce useEffect Dependencies
- [ ] **PERF-010** (2h) - getProjectDir Cache Limit
- [ ] **CODE-002** (4h) - Standardize ESM/CJS
- [ ] **CODE-004** (4h) - ESLint State.ts Enforcement

**Subtotal:** 86 hours (~2 weeks, 1 developer)

---

## Implementation Details: TIER 1

### SEC-010: MCP Tool Description Injection

**Current Behavior:**
```typescript
// MCP tool descriptions/schemas are passed to model without sanitization
// Location: src/services/mcp/mcpClient.ts, src/tools/MCPTool/
const toolDef = {
  name: tool.name,
  description: tool.description,  // ⚠️ User input, could contain injection
  input_schema: tool.schema        // ⚠️ Not validated
}
```

**Fix Implementation:**
```typescript
// 1. Create sanitization utility
// src/utils/mcp/sanitizeToolMetadata.ts
export function sanitizeToolDescription(desc: string): string {
  // Remove markdown, scripts, extreme length
  return desc
    .replace(/<[^>]*>/g, '')           // Remove HTML
    .replace(/\*{2,}/g, '*')           // Normalize emphasis
    .substring(0, 500)                 // Limit length
    .trim()
}

export function validateToolSchema(schema: unknown): object {
  // Validate input schema is safe JSON
  if (typeof schema !== 'object') throw new Error('Invalid schema')
  // Limit depth and size
  return schema
}

// 2. Apply in mcpClient.ts before sending to model
const sanitized = {
  name: validateToolName(tool.name),
  description: sanitizeToolDescription(tool.description),
  input_schema: validateToolSchema(tool.schema)
}
```

**Files to Modify:**
- `src/services/mcp/mcpClient.ts` - Apply sanitization on tool registration
- `src/tools/MCPTool/UI.tsx` - Sanitize descriptions in UI
- **Create:** `src/utils/mcp/sanitizeToolMetadata.ts`

**Testing:**
```bash
# Test with malicious descriptions
- "echo pwned"
- "<script>alert('xss')</script>"
- "a".repeat(10000)
```

**Estimated Effort:** 8 hours

---

### SEC-014: Dependency Vulnerability Audit

**Current Issue:** No npm audit or dependency scanning

**Fix:**

1. **Add to package.json/bunfig.toml:**
```json
{
  "scripts": {
    "audit": "bun audit",
    "audit-fix": "bun audit --fix"
  }
}
```

2. **Create GitHub Action (.github/workflows/audit.yml):**
```yaml
name: Dependency Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun audit
```

3. **Pin vulnerable dependencies** in bundled versions

**Files:**
- `package.json` / `bunfig.toml` - Add audit scripts
- `.github/workflows/audit.yml` - Create action

**Estimated Effort:** 4 hours

---

### SEC-015: /proc/environ Credentials Leak

**Current Issue:** API keys readable by same-UID processes

**Fix:**

1. **Use secure credential storage (already partially done):**
```typescript
// src/utils/secureStorage/
// Verify macOS Keychain integration is used for all credentials
// Verify Windows Credential Manager integration
// Verify Linux secret-service integration
```

2. **Ensure credentials NOT passed via environment:**
```typescript
// ❌ BAD - API key in process.env
const key = process.env.ANTHROPIC_API_KEY

// ✅ GOOD - From secure storage
const key = await getSecureStorage().getAPIKey()
```

3. **Audit all credential sources:**
- Auth.ts - ✅ Uses secure storage (keychain)
- MCP helpers - ✅ Already fixed in SEC-006
- Browser launches - ✅ No credentials passed

4. **Add credential sanitization at process start:**
```typescript
// src/utils/secureStartup.ts (create new)
export function sanitizeProcessEnv(): void {
  // Remove known credential env vars before spawning subprocesses
  const SENSITIVE_VARS = [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'GOOGLE_API_KEY',
    'AWS_SECRET_ACCESS_KEY'
  ]
  for (const key of SENSITIVE_VARS) {
    delete process.env[key]
  }
}
```

**Files:**
- `src/utils/secureStartup.ts` - Create new
- `src/utils/auth.ts` - Call sanitizeProcessEnv() at startup
- `src/utils/secureStorage/` - Verify keychain usage

**Estimated Effort:** 6 hours

---

### SEC-016: Pre-signed URLs in Cache

**Current Issue:** Pre-signed URLs stored as plaintext cache keys

**Fix:**

```typescript
// src/utils/cache.ts (modify)
import crypto from 'crypto'

// Before: cacheMap[url] = response
// After:
function getCacheKey(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex')
}

const cacheMap = new Map<string, CachedResponse>()
cacheMap.set(getCacheKey(url), response)

// Redact URLs in logs:
function redactPresignedUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.searchParams.has('X-Amz-Signature')) {
      u.searchParams.set('X-Amz-Signature', '[REDACTED]')
    }
    return u.toString()
  } catch {
    return '[INVALID_URL]'
  }
}
```

**Files:**
- `src/utils/cache.ts` - Hash cache keys, redact in logs
- `src/utils/debug.ts` - Add presigned URL redaction

**Estimated Effort:** 2 hours

---

### CODE-003: Remove Testing Seams from Production

**Current State:**
```typescript
// src/utils/sessionStorage.ts (lines 470-485)
export function resetProjectFlushStateForTesting(): void { ... }
export function resetProjectForTesting(): void { ... }
export function setSessionFileForTesting(path: string): void { ... }
```

**Fix:**

1. **Create test utilities file:**
```typescript
// src/utils/__testing__/sessionStorageTestUtils.ts (create new)
import { getProject } from '../sessionStorage.js'

export function resetProjectFlushStateForTesting(): void {
  getProject()?._resetFlushState()
}

export function resetProjectForTesting(): void {
  // Reset singleton
}

export function setSessionFileForTesting(path: string): void {
  getProject().sessionFile = path
}
```

2. **Remove from sessionStorage.ts**

3. **Update test imports** (when tests are written):
```typescript
import { resetProjectForTesting } from '../__testing__/sessionStorageTestUtils'
```

**Files:**
- **Create:** `src/utils/__testing__/sessionStorageTestUtils.ts`
- **Modify:** `src/utils/sessionStorage.ts` - Remove exports
- **Config:** `tsconfig.json` - Exclude __testing__ from production builds

**Estimated Effort:** 3 hours

---

### CODE-007: Fix Silent Error Swallowing

**Current Issue:** Unexpected errors caught and converted to false/null without logging

**Fix:**

Audit pattern:
```typescript
// ❌ BAD - Silent swallowing
try {
  return await loadConfig()
} catch {
  return false  // What error? Why did it fail?
}

// ✅ GOOD - Log unexpected errors
try {
  return await loadConfig()
} catch (error) {
  if (error instanceof ConfigNotFoundError) {
    return false  // Expected error
  }
  logForDebugging(`Unexpected error in loadConfig: ${error}`)
  return false  // Unexpected but can't throw
}
```

**Implementation:**

1. **Audit all catch blocks** (405 TODO markers show systematic issues)
2. **Categorize errors:**
   - Expected: File not found, permission denied, timeout
   - Unexpected: All others should be logged

3. **Create error classification utility:**
```typescript
// src/utils/errorClassification.ts (create new)
export function isExpectedError(error: unknown): boolean {
  if (error instanceof FileNotFoundError) return true
  if (error instanceof PermissionError) return true
  if (error instanceof TimeoutError) return true
  return false
}

export async function tryOrLog<T>(
  fn: () => Promise<T>,
  fallback: T,
  context: string
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (!isExpectedError(error)) {
      logForDebugging(`${context}: ${error}`)
    }
    return fallback
  }
}
```

4. **Apply to high-risk areas:**
   - Auth helpers
   - MCP client
   - File operations
   - API calls

**Files:**
- **Create:** `src/utils/errorClassification.ts`
- **Modify:** Error-handling code in 10-15 files

**Estimated Effort:** 6 hours

---

### PERF-005: Merge Filter/Map Chains

**Found Instances:** 20+ across codebase

**Example Fix:**
```typescript
// ❌ BAD: Multiple passes
messages
  .filter(m => m.type === 'assistant')
  .map(m => m.id)

// ✅ GOOD: Single pass
const result: string[] = []
for (const m of messages) {
  if (m.type === 'assistant') {
    result.push(m.id)
  }
}
```

**Files to Fix:**
1. `src/main.tsx:1417` - mcpConfig filtering
2. `src/main.tsx:1473` - allConfigs filtering
3. `src/tasks/RemoteAgentTask/RemoteAgentTask.tsx` (3 instances)
4. `src/tools/AgentTool/UI.tsx` (2 instances)
5. `src/tools/LSPTool/LSPTool.ts` (3 instances)
6. `src/utils/swarm/inProcessRunner.ts`
7. `src/utils/processUserInput/processSlashCommand.tsx` (2 instances)
8. `src/utils/plugins/dependencyResolver.ts` (2 instances)
9. `src/utils/plugins/pluginDirectories.ts`
10. `src/utils/plugins/cacheUtils.ts`

**Script to help identify:**
```bash
grep -rn "\.filter.*\.map\|\.map.*\.filter" src --include="*.ts" --include="*.tsx"
```

**Estimated Effort:** 8 hours

---

### PERF-004: Incremental Map/Set Rebuilding

**Current Issue:**
```typescript
// src/utils/messages.ts:1160-1340
function buildMessageLookups(messages: Message[]) {
  // Rebuilds 6 maps from scratch on every render
  const byId = new Map()
  const byType = new Map()
  // ... etc for each message
}
```

**Fix:**

```typescript
// Maintain incremental state
class MessageLookups {
  private byId = new Map<string, Message>()
  private byType = new Map<string, Message[]>()

  // Only update for new/changed messages
  updateFromMessages(messages: Message[], lastIndex: number) {
    for (let i = lastIndex; i < messages.length; i++) {
      const msg = messages[i]
      this.byId.set(msg.id, msg)
      if (!this.byType.has(msg.type)) {
        this.byType.set(msg.type, [])
      }
      this.byType.get(msg.type)?.push(msg)
    }
  }
}
```

**Implementation:**
1. Create incremental lookup manager
2. Update on message append, not full rebuild
3. Cache based on message count + hash

**Files:**
- `src/utils/messages.ts` - Refactor buildMessageLookups

**Estimated Effort:** 12 hours

---

## TIER 2: Architecture Foundation

### ARCH-003: Establish Vitest Test Suite (PREREQUISITE)

**Why This First:** Required before ARCH-001/002/004. Provides safety net for refactoring.

**Phase 1: Utility Tests (Week 1)**
```typescript
// vitest.config.ts (create new)
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  }
})

// src/utils/__tests__/path.test.ts
import { describe, it, expect } from 'vitest'
import { expandPath, containsPathTraversal } from '../path'

describe('expandPath', () => {
  it('expands tilde to home directory', () => {
    expect(expandPath('~')).toBe(process.env.HOME)
  })

  it('handles relative paths', () => {
    // test relative resolution
  })
})

describe('containsPathTraversal', () => {
  it('detects .. patterns', () => {
    expect(containsPathTraversal('../etc/passwd')).toBe(true)
    expect(containsPathTraversal('/etc/passwd')).toBe(false)
  })
})
```

**Target:** 20 test files covering:
- `createUserMessage`
- `normalizeMessages`
- `getProjectDir`
- `expandPath`
- `containsPathTraversal`
- `isPermittedRedirect`

**Estimated Effort:** 80 hours (15 test files × 5h each)

---

### ARCH-001: Decompose God Files (After ARCH-003)

**Messages.ts Decomposition:**
```
src/utils/messages/
├── creation.ts       (createUserMessage, createAssistantMessage)
├── normalization.ts  (normalizeMessages, normalizeMessagesForAPI)
├── streaming.ts      (streaming handlers)
├── formatting.ts     (formatMessageForOutput)
└── index.ts          (re-exports)
```

**SessionStorage.ts Decomposition:**
```
src/utils/sessionStorage/
├── filesystem.ts     (file I/O, append)
├── metadata.ts       (title, tags, session info)
├── transcript.ts     (conversation chain)
├── lookups.ts        (message indexes)
└── index.ts          (main class)
```

**Estimated Effort:** 80 hours (4 modules × 20h each)

---

### ARCH-002: Reduce Global State (After ARCH-003)

**Current:**
```typescript
// src/bootstrap/state.ts - 100+ fields, 251 importers
export const getState = (): AppState => ({ ... })
```

**Target:**
```typescript
// Move process-lifetime only:
- sessionId
- startTime
- originalCwd
- configDir

// Move to context/store:
- UI state
- Streaming state
- Tool state
- User preferences
```

**Estimated Effort:** 80 hours (refactor all 251 importers)

---

### ARCH-004: Resolve Circular Imports

**Root Cycle:**
```
teammate.ts → AppState.tsx → hooks.tsx → main.tsx → teammate.ts
```

**Solution:** Extract interface module:
```typescript
// src/types/teammate.ts (new)
export interface TeammateAPI { ... }
export interface TeammateState { ... }

// Break cycle by depending on types, not implementations
```

**Estimated Effort:** 40 hours (dependency graph refactoring)

---

## Quick Command Reference

### Complete All TIER 1 (Execute in order)
```bash
# 1. SEC-010 - MCP sanitization (8h)
# 2. SEC-014 - Dependency audit (4h)
# 3. SEC-015 - Credential leak (6h)
# 4. SEC-016 - Cache hashing (2h)
# 5. CODE-003 - Remove test seams (3h)
# 6. CODE-007 - Error handling (6h)
# 7. PERF-005 - Filter/map merge (8h)
# 8. PERF-004 - Incremental rebuilds (12h)

# Total: ~49 hours (~1 week)

# Then commit
git add -A && git commit -m "fix: Complete all TIER 1 quick wins (SEC-010/014/015/016, CODE-003/007, PERF-005/004)"
```

### Complete ARCH-003 (Prerequisite)
```bash
# Set up Vitest
# Write 20 test files for utilities
# Run: npm test (or bun test)
# Commit test infrastructure
# Only then proceed to ARCH-001/002/004
```

---

## Success Criteria

✅ **After TIER 1:** 18/27 fixes (67%), 49 hours
✅ **After ARCH-003:** 18/27 fixes + test foundation, 129 hours
✅ **After ARCH-001/002/004:** 22/27 fixes (81%), 409 hours
✅ **After TIER 3:** 27/27 fixes (100%), 495 hours

---

## Non-RES Design Principles

✅ **Maintained:**
- General-purpose CLI (not election services specific)
- Pluggable architecture (MCP, multiple APIs)
- Security-first (all hardening is universal)
- Performance-optimized (no RES-specific patterns)

❌ **Avoided:**
- RES configuration assumptions
- FSC/Salesforce-specific code
- Election domain terminology
- RES plugin patterns

---

**Framework Complete.** Ready to execute all 18 remaining fixes systematically.
Each fix has clear implementation guidance and estimated hours.
All changes maintain general-purpose design principles.

**Next Step:** Begin TIER 1 execution (8 fixes, ~49 hours)
