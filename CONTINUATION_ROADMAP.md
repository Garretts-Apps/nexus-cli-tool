# Nexus CLI Implementation - Continuation Roadmap

**Status:** 9/27 fixes completed (33%) across 2 sessions
**Last Updated:** 2026-04-04
**Focus:** General-purpose CLI tool (non-RES specific)

---

## Session 2 Achievements (This Session)

### Fixes Completed: 6
- **SEC-009** - Cross-origin redirect bypass (enforce exact hostname)
- **SEC-011** - Scrub credentials from auth helper logs
- **SEC-013** - Path traversal using normalize() vs regex
- **PERF-007** - drainWriteQueue single-pass cleanup
- **PERF-009** - statSync → existsSync for file checks
- **Core Skills Documentation** - nexus-core.md (learnings from architecture)

### Commits: 2
```
09467fb docs: Add implementation completion summary
3a2f694 fix: Apply 6 additional security and performance fixes
```

---

## Session 1 Achievements (Previous)

### Fixes Completed: 3
- **PERF-001** - O(N²) string concatenation fix
- **PERF-002** - Chained filter/map operations
- **PERF-003** - useMemo caching for lastAssistantMessage

### Framework Additions: 2
- **Multi-API Support** - Claude/Gemini/OpenAI adapter (fully functional)
- **Global Rebranding** - 223 files updated to "Nexus"

### Commits: 6+

---

## Remaining Work Prioritized (18/27 fixes)

### TIER 1: High-Impact, Medium Effort (5-10 days)

#### Security (4 items)
1. **SEC-010** (L) - MCP tool descriptions injection
   - **Issue:** Tool descriptions/schemas injected without sanitization
   - **Fix:** Validate and sanitize MCP tool metadata before model context
   - **Files:** src/services/mcp/, src/tools/MCPTool/
   - **Estimated:** 8 hours

2. **SEC-014** (S) - Dependency vulnerability audit
   - **Issue:** No npm audit or dependency scanning
   - **Fix:** Add npm audit to build pipeline, pin vulnerable deps
   - **Estimated:** 4 hours

3. **SEC-015** (L) - /proc/environ credentials leak
   - **Issue:** API keys readable by same-UID processes
   - **Fix:** Use secure credential storage (already partially done with keychain)
   - **Estimated:** 6 hours

4. **SEC-016** (XS) - Pre-signed URLs in cache
   - **Issue:** Pre-signed URLs stored as plaintext cache keys
   - **Fix:** Hash cache keys, redact in logs
   - **Estimated:** 2 hours

#### Code Quality (3 items)
1. **CODE-007** (M) - Silent error swallowing
   - **Issue:** Unexpected errors converted to false returns (hides bugs)
   - **Files:** src/utils/error-handling patterns
   - **Estimated:** 6 hours

2. **CODE-003** (S) - Remove testing seam functions from production
   - **Issue:** resetProjectFlushStateForTesting() exported from sessionStorage.ts
   - **Files:** src/utils/sessionStorage.ts (lines 470+)
   - **Fix:** Move to separate test file or mock
   - **Estimated:** 3 hours

3. **CODE-001** (M) - Reduce REPL complexity
   - **Issue:** REPL.tsx is 5,005 lines with 40+ state vars, 28 useEffects
   - **Requires:** Extract custom hooks
   - **Estimated:** 20 hours (smaller refactor subset)

#### Performance (2 items)
1. **PERF-005** (M) - Merge remaining chained filter/map operations
   - **Issue:** 20+ instances of .filter().map() chains across codebase
   - **Priority Files:** src/utils/, src/tools/, src/tasks/
   - **Estimated:** 8 hours

2. **PERF-004** (L) - Incremental map/set rebuilding
   - **Issue:** buildMessageLookups rebuilds 6 maps from scratch
   - **Files:** src/utils/messages.ts (lines 1160-1340)
   - **Fix:** Maintain incremental state, append-only pattern
   - **Estimated:** 12 hours

### TIER 2: High-Effort, Architectural (80+ hours each)

These are **prerequisites for major refactoring** and should follow test infrastructure setup:

1. **ARCH-003** (XL) - Establish Vitest test suite (PREREQUISITE)
   - **Effort:** 80 hours
   - **Value:** Enables safe refactoring for ARCH-001/002/004
   - **Phase 1:** Utility functions (createUserMessage, normalizeMessages, getProjectDir)
   - **Phase 2:** Session storage (file I/O mocking)
   - **Phase 3:** React components (testing-library)
   - **Target:** 20% coverage on messages.ts + sessionStorage.ts

2. **ARCH-001** (XL) - Decompose god files
   - **Effort:** 80 hours
   - **Files:** messages.ts (5,512 lines) → 4 modules
   - **Files:** sessionStorage.ts (5,105 lines) → 4 modules
   - **Requires:** ARCH-003 (tests for safety)

3. **ARCH-002** (XL) - Reduce global state singleton
   - **Effort:** 80 hours
   - **File:** src/bootstrap/state.ts (100+ fields, 251 importers)
   - **Approach:** Move to context/store, limit to process invariants
   - **Requires:** ARCH-003 (tests)

4. **ARCH-004** (L) - Resolve circular imports
   - **Effort:** 40 hours
   - **Issue:** 33+ runtime require() calls as circular dependency workarounds
   - **Root:** teammate.ts → AppState.tsx → ... → main.tsx cycle
   - **Fix:** Extract interface boundaries, resolve dependency graph

### TIER 3: Optional/Backlog (7 LOW items, ~12 hours)

- **SEC-004** (40h) - BashTool rate limiting (complex state management)
- **PERF-010** (XS) - getProjectDir cache size limit
- **PERF-008** (M) - Reduce useEffect dependencies on messages array
- **CODE-006** (M) - Consolidate 405 TODO/FIXME markers
- **CODE-004** (M) - Add ESLint enforcement for state.ts usage
- **CODE-008** (XS) - Remove/inline median() utility
- **CODE-002** (M) - Standardize ESM/CJS require patterns

---

## Recommended Execution Path

### Weeks 1-2: Quick Wins (15-20 hours)
```
1. SEC-014 - Dependency audit (4h)
2. SEC-016 - Cache key hashing (2h)
3. CODE-003 - Remove testing seams (3h)
4. PERF-005 - Merge filter/map chains (8h)
5. SEC-015 - Process env leak (6h)
```

### Week 3: Mid-Complexity (20-25 hours)
```
1. SEC-010 - MCP tool sanitization (8h)
2. CODE-007 - Error swallowing audit (6h)
3. PERF-004 - Incremental rebuilding (12h)
```

### Weeks 4+: Foundation & Major Refactors
```
Phase 1: ARCH-003 (Vitest setup) - 80 hours
├── Essential for safe refactoring
├── Enables ARCH-001/002/004 to proceed
└── Creates continuous testing infrastructure

Phase 2: ARCH-001/002/004 (240 hours combined)
├── Only after ARCH-003 complete
├── Reduces codebase maintenance burden
└── Improves code clarity and testability
```

---

## Non-RES Architecture Principles

Nexus CLI is maintained as **general-purpose** — not tailored to RES/election services.

✅ **Adopt from res-* patterns:**
- Multi-agent orchestration patterns (general)
- Security hardening standards (universal)
- Performance optimization strategies (universal)
- Documentation and skill patterns

❌ **Avoid from res-* patterns:**
- RES-specific domain rules
- Election services terminology
- RES configuration assumptions
- FSC/Salesforce-specific logic

---

## Testing Strategy

### Current State
- **Zero tests** across 512k lines
- Testing seams exist (resetProjectFlushStateForTesting, setSessionFileForTesting)
- High risk for regressions on any refactoring

### Phase 1: Utility Functions (Low Risk)
```typescript
// No I/O, no React, pure functions
- createUserMessage(...)
- normalizeMessages(...)
- getProjectDir(...)
- expandPath(...)
- containsPathTraversal(...)
- isPermittedRedirect(...)
```

### Phase 2: Session Storage (Medium Risk)
```typescript
// Requires file I/O mocking
- sessionIdExists(...)
- writeSessionFile(...)
- appendToFile(...)
- readSessionMetadata(...)
```

### Phase 3: React Components (Higher Risk)
```typescript
// Requires testing-library + hook mocking
- REPL component hooks
- Tool integration components
```

---

## Known Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Large godfiles hard to refactor safely | ARCH-003 (tests) prerequisite |
| Global state creates unknown dependencies | ARCH-002 tracks all 251 importers |
| Circular imports mask structural issues | ARCH-004 resolves with interface modules |
| No tests = high regression risk | ARCH-003 establishes foundation |
| MCP tool injection possible | SEC-010 sanitizes descriptors |

---

## Success Metrics

After completion of all fixes:
- ✅ Zero critical/high security vulnerabilities
- ✅ Performance: <100ms startup, efficient batch processing
- ✅ Test coverage: 20%+ on core modules
- ✅ Code clarity: God files decomposed, <2000 lines each
- ✅ Maintainability: <50 TODO markers, clear separation of concerns

---

## Implementation Checklist

### Session 2 Complete ✅
- [x] SEC-009, SEC-011, SEC-013, PERF-007, PERF-009
- [x] Core skills documentation (nexus-core.md)
- [x] Implementation status report

### Next Session
- [ ] Implement TIER 1 quick wins (SEC-010/014/015/016, CODE-003/007, PERF-005/004)
- [ ] Target: 18/27 fixes (67%)
- [ ] Prepare ARCH-003 planning

### Future Sessions
- [ ] ARCH-003 (test infrastructure)
- [ ] ARCH-001/002/004 (major refactoring)
- [ ] Final verification and hardening

---

## Files for Reference

- **IMPLEMENTATION_COMPLETION_SUMMARY.md** - Detailed status
- **.claude/skills/nexus-core.md** - Architecture learnings
- **REBUILD_ANALYSIS.md** - Full technical analysis (previous)

---

**Generated:** 2026-04-04
**Maintainer:** Claude Code + Happy
**License:** Same as parent project
**Status:** Ready for continued development
