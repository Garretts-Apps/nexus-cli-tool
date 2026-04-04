# Nexus Core Skills

Reusable knowledge and architectural patterns for Nexus CLI development. This document consolidates learnings from the rebuild analysis and reference architectures (res-claude-code-config, res-orchestration).

## Multi-API Architecture

**Status:** Implemented (3 providers: Claude, Gemini, OpenAI)

**Pattern:** Unified adapter with provider-specific normalization.

### Configuration
```
Environment Variables:
  NEXUS_API_PROVIDER      Provider selection (claude|gemini|openai)
  NEXUS_API_KEY          API authentication token
  NEXUS_API_ENDPOINT     Optional custom endpoint override
```

### Implementation Locations
- `src/services/api/multiApiAdapter.ts` (363 lines) — Main adapter with normalization functions
- `src/bootstrap/state.ts` — API provider state management
- `src/components/APIConfigurationDialog.tsx` — Runtime configuration UI

### Key Functions
- `getAPIProviderConfig()` — Resolve provider from env/settings
- `normalizeRequestForProvider()` — Convert internal request format
- `normalizeResponseFromProvider()` — Normalize API response to internal format
- `validateAPIProviderConfig()` — Validate provider configuration

### Design Principles
1. **Abstraction:** Single interface hides provider differences
2. **Extensibility:** Adding new provider requires only adapter functions
3. **Backward Compatibility:** Defaults to Claude (Anthropic API)
4. **Environment-Driven:** Configuration via env vars, not code changes

---

## Security Patterns

### 1. Shell Injection Prevention

**Vulnerabilities Addressed:** SEC-001, SEC-002, SEC-005, SEC-012

**Pattern:** Never trust environment or user-provided paths in shell execution.

#### Rule: Array Arguments, No Shell
```typescript
// BAD
await execa(path, { shell: true })           // implicit /bin/sh -c
child_process.exec(cmd, ...)                 // implicit /bin/sh
spawn(`${editor} ${file}`, { shell: true })  // concatenation + shell

// GOOD
await execa(path, [...args], { shell: false })  // direct execution
spawn(editor, [file], { shell: false })         // array args
```

**Implementation Files:**
- `src/utils/auth.ts` (SEC-001) — Credential helper invocation
- `src/services/mcp/headersHelper.ts` (SEC-002) — MCP header script
- `src/utils/editor.ts` (SEC-005) — Editor path handling
- `src/utils/browser.ts` (SEC-012) — Browser URL launching

**Key Fix Pattern:**
1. Validate helper/executable paths (reject `[;&|$<>]` metacharacters)
2. Pass arguments as array, not concatenated string
3. Set `shell: false` explicitly
4. Minimize environment variables passed (only PATH + HOME + domain-specific vars)

---

### 2. SSRF Prevention (Private IP Blocking)

**Vulnerability Addressed:** SEC-003

**Pattern:** Block access to internal metadata services and private IP ranges.

#### Blocked Ranges
```
127.0.0.1/8          (Loopback)
169.254.169.254      (AWS IMDS)
10.0.0.0/8           (RFC 1918)
172.16.0.0/12        (RFC 1918)
192.168.0.0/16       (RFC 1918)
::1/128              (IPv6 loopback)
fc00::/7             (IPv6 private)
fe80::/10            (IPv6 link-local)
```

**Implementation:** `src/tools/WebFetchTool/utils.ts` — `validateURL()` function

**Design Pattern:**
1. Parse URL to extract hostname
2. Validate against blocked IP ranges using regex matching
3. Reject localhost, loopback, private ranges
4. Allow public HTTPS only for external fetch

---

### 3. Certificate Validation & Pinning

**Vulnerability Addressed:** SEC-007

**Pattern:** Verify downloaded CA certificates against expected public key pins.

#### Implementation
- `src/upstreamproxy/upstreamproxy.ts` (lines 254-290)
- `CERTIFICATE_PINS` mapping: endpoint → expected public key
- `validateCertificatePin()` — Extract and validate public key
- `isPemCertificate()` — Validate PEM format

#### Design Principles
1. **Pin Expected Keys:** Map API endpoints to known good public keys
2. **Verify Before Trust:** Validate downloaded certs against pins
3. **Prevent MITM:** Even with valid forged certificates, pinning blocks interception
4. **Audit Trail:** Log certificate changes for investigation

---

### 4. Environment Variable Minimization

**Vulnerability Addressed:** SEC-006

**Pattern:** Pass only essential environment variables to helper subprocesses.

#### Rule: Minimal Env Context
```typescript
// BAD
env: { ...process.env }  // Leaks ANTHROPIC_API_KEY, AWS creds, tokens

// GOOD
env: {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  NEXUS_MCP_SERVER_NAME: config.serverName,
  NEXUS_MCP_SERVER_URL: config.serverUrl
}
```

**Implementation:** `src/services/mcp/headersHelper.ts` — Header helper subprocess

---

## Performance Patterns

### 1. Single-Pass Array Processing

**Fix:** PERF-001 (String concatenation in write loops)

**Pattern:** Accumulate in array, join once.

```typescript
// BAD: O(N²) string copies
let content = ''
for (const entry of batch) {
  content += stringify(entry) + '\n'  // Reallocates entire string each time
}
await write(content)

// GOOD: O(N) single allocation
const lines: string[] = []
for (const entry of batch) {
  lines.push(stringify(entry))
}
await write(lines.join('\n'))
```

**Implementation:** `src/utils/sessionStorage.ts` (lines 650-680)

**Impact:** 100MB batches: ~500MB GC pressure → negligible

---

### 2. Merged Filter-Map Chains

**Fix:** PERF-002 (Chained filter().map() operations)

**Pattern:** Single for-loop instead of multiple array passes.

```typescript
// BAD: 2+ O(N) passes
messages
  .filter(m => m.type === 'assistant')
  .map(m => m.id)

// GOOD: Single O(N) pass
const result: string[] = []
for (const m of messages) {
  if (m.type === 'assistant') result.push(m.id)
}
```

**Implementation:** `src/utils/messages.ts` (lines 1140-1149)

---

### 3. Memoized O(N) Scans

**Fix:** PERF-003 (Per-token array search in useMemo)

**Pattern:** Cache expensive search behind memoization.

```typescript
// BAD: findLast() fires on every token (10-30 renders/sec)
const lastAssistant = useMemo(() => {
  return messages.findLast(m => m.type === 'assistant')
}, [messages])  // messages changes on every token delta

// GOOD: Memoize with tight dependencies
const lastAssistant = useMemo(() => {
  return getLastAssistantMessage(messages)
}, [messages.length])  // Change only on new message, not token delta
```

**Implementation:** `src/components/FeedbackSurvey/useFeedbackSurvey.tsx` (lines 49-53)

---

### 4. Set-Based Lookups

**Fix:** PERF-006 (Array.includes() vs Set)

**Pattern:** Use Set for O(1) membership testing.

```typescript
// BAD: O(N) per lookup
const types = ['image', 'document', 'audio']
if (types.includes(fileType)) { ... }

// GOOD: O(1) per lookup
const types = new Set(['image', 'document', 'audio'])
if (types.has(fileType)) { ... }
```

**Implementation:** `src/utils/messages.ts` (lines 4282-4289)

---

## Code Quality Standards

### Feature Flag Pattern

**Fix:** CODE-005 (Hardcoded feature flags)

**Pattern:** Environment-driven feature enablement.

```typescript
// BAD: Hardcoded
export function isCustomTitleEnabled() {
  return true  // Dead logic, not configurable
}

// GOOD: Environment-driven
export function isCustomTitleEnabled() {
  return process.env.NEXUS_ENABLE_CUSTOM_TITLES !== 'false'
}
```

**Implementation:** `src/utils/sessionStorage.ts` (lines 427-429)

**Benefits:**
1. Disable features in production without code changes
2. A/B testing and gradual rollout
3. Performance tuning per environment

---

### Error Scrubbing Pattern

**Principle:** Never leak credentials in logs.

**Implementation Locations:**
- `src/utils/debug.ts` — Auth helper output filtering
- Any subprocess stderr capture

**Pattern:**
```typescript
const stdout = execResult.stdout
// Scrub before logging: remove API keys, tokens, credentials
const scrubbed = scrubAuthTokens(stdout)
logForDebugging(`Helper output: ${scrubbed}`)
```

---

## Testing Strategy

### Current State
- **Zero tests** across 512k lines
- Testing seams exist (`resetProjectFlushStateForTesting`, `setSessionFileForTesting`)
- Prerequisite for all refactoring work

### Recommended Path (ARCH-003)

**Phase 1: Pure Utilities** (low risk, high value)
- `createUserMessage()` tests
- `normalizeMessages()` tests
- `getProjectDir()` tests
- No I/O dependencies, no React

**Phase 2: Session Storage** (medium risk)
- File I/O mocking
- Session metadata tests
- Transcript writing tests

**Phase 3: UI Components** (high risk)
- React testing library
- Hook-based component tests
- Streaming simulation tests

**Target:** 20% coverage on messages.ts + sessionStorage.ts before major refactors

---

## Remaining High-Priority Items

| ID | Category | Status | Effort |
|----|----------|--------|--------|
| SEC-004 | Security | Pending | 40h |
| SEC-008 | Security | In Progress | S |
| SEC-009 | Security | Pending | S |
| PERF-005 | Performance | Pending | M |
| PERF-007 | Performance | Pending | XS |
| PERF-008 | Performance | Pending | M |
| PERF-009 | Performance | Pending | S |
| ARCH-001 | Architecture | Pending | 80h |
| ARCH-002 | Architecture | Pending | 80h |
| ARCH-003 | Architecture | Pending | 80h |
| ARCH-004 | Architecture | Pending | 40h |

---

## Enforcement Hooks (Planned)

Based on res-claude-code-config pattern, implement 4 hooks:

1. **Security Guard** (PreToolUse on Bash)
   - Block destructive commands without confirmation
   - Auto-add LIMIT to unbounded SQL queries

2. **File Write Guard** (PreToolUse on Write/Edit)
   - Block writes outside workspace
   - Flag sensitive files (.env, credentials.json)

3. **Audit Log** (PostToolUse)
   - Log all tool invocations to `.nexus-logs/audit.jsonl`
   - Enable forensic review

4. **Knowledge Capture** (Stop event)
   - Auto-write discovered patterns to `.github/knowledge/`
   - Enable continuous learning

---

## Documentation Standards

Follow res-claude-code-config patterns:
- Plain markdown files in `.github/knowledge/`
- Observations → Hypotheses (2 confirmations) → Rules (5 confirmations)
- Run consolidation script to promote/demote/prune rules
- Version control knowledge alongside code

---

**Generated:** 2026-04-04
**Based on:** IMPLEMENTATION_STATUS.md + res-claude-code-config analysis
**Next Update:** After completing remaining 24 fixes
