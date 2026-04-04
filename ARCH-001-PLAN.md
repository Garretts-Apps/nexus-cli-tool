# messages.ts Decomposition Plan (ARCH-001)

**Source**: `src/utils/messages.ts` (5,649 lines, 115 exports)
**Test**: `src/utils/messages.test.ts` (326 lines, 8 tested functions)
**Importers**: 107 files across the codebase

---

## Target Structure

| Module | Est. Lines | Description |
|--------|-----------|-------------|
| `messageConstants.ts` | ~150 | Constants, sentinel values, type guards for synthetic/special messages |
| `messageCreation.ts` | ~450 | Factory functions for all message types (user, assistant, system, progress, etc.) |
| `messageNormalization.ts` | ~1,200 | `normalizeMessages`, `normalizeMessagesForAPI`, `normalizeContentFromAPI`, and all internal helpers used only by normalization |
| `messageMerging.ts` | ~350 | `mergeUserMessages`, `mergeAssistantMessages`, `mergeUserContentBlocks`, `mergeUserMessagesAndToolResults`, and helpers (hoistToolResults, joinTextAtSeam, smoosh*) |
| `messageLookups.ts` | ~650 | `buildMessageLookups`, `buildSubagentLookups`, incremental cache, all `*FromLookup` accessors |
| `messageFiltering.ts` | ~500 | `filterUnresolvedToolUses`, `filterWhitespaceOnlyAssistantMessages`, `filterOrphanedThinkingOnlyMessages`, `stripSignatureBlocks`, `stripAdvisorBlocks`, `ensureToolResultPairing` |
| `messageUtilities.ts` | ~350 | Text extraction, tag parsing, text wrapping, content helpers |
| `messageAttachments.ts` | ~900 | `normalizeAttachmentForAPI` and all plan-mode/auto-mode instruction builders |
| `messageStream.ts` | ~200 | `handleMessageFromStream`, `StreamingToolUse`, `StreamingThinking` types |
| `messages.ts` (barrel) | ~120 | Re-exports everything for backwards compatibility |

**Total**: ~4,870 lines in modules + ~120 barrel = ~4,990 (slight reduction from consolidating imports)

---

## Per-Module Breakdown

### 1. `messageConstants.ts` (~150 lines)

**Exports:**
- `INTERRUPT_MESSAGE`
- `INTERRUPT_MESSAGE_FOR_TOOL_USE`
- `CANCEL_MESSAGE`
- `REJECT_MESSAGE`
- `REJECT_MESSAGE_WITH_REASON_PREFIX`
- `SUBAGENT_REJECT_MESSAGE`
- `SUBAGENT_REJECT_MESSAGE_WITH_REASON_PREFIX`
- `PLAN_REJECTION_PREFIX`
- `DENIAL_WORKAROUND_GUIDANCE`
- `AUTO_REJECT_MESSAGE(toolName)` - function returning string
- `DONT_ASK_REJECT_MESSAGE(toolName)` - function returning string
- `NO_RESPONSE_REQUESTED`
- `SYNTHETIC_TOOL_RESULT_PLACEHOLDER`
- `SYNTHETIC_MODEL`
- `SYNTHETIC_MESSAGES` - Set
- `PLAN_PHASE4_CONTROL`
- `MEMORY_CORRECTION_HINT` (private constant, used by `withMemoryCorrectionHint`)
- `AUTO_MODE_REJECTION_PREFIX` (private constant, used by `isClassifierDenial`)
- `TOOL_REFERENCE_TURN_BOUNDARY` (private constant, used by normalization)

**Type guards on constants:**
- `isSyntheticMessage(message)`
- `isClassifierDenial(content)`
- `buildYoloRejectionMessage(reason)`
- `buildClassifierUnavailableMessage(toolName, classifierModel)`
- `withMemoryCorrectionHint(message)`

**Internal imports needed:** `feature` from `bun:bundle`, `isAutoMemoryEnabled`, `getFeatureValue_CACHED_MAY_BE_STALE`
**Depended on by:** messageCreation, messageNormalization, messageFiltering, messageUtilities

---

### 2. `messageCreation.ts` (~450 lines)

**Exports:**
- `createAssistantMessage({content, usage, isVirtual})`
- `createAssistantAPIErrorMessage({content, apiError, error, errorDetails})`
- `createUserMessage({content, isMeta, ...})`
- `prepareUserContent({inputString, precedingInputBlocks})`
- `createUserInterruptionMessage({toolUse})`
- `createSyntheticUserCaveatMessage()`
- `formatCommandInputTags(commandName, args)`
- `createModelSwitchBreadcrumbs(modelArg, resolvedDisplay)`
- `createProgressMessage({toolUseID, parentToolUseID, data})`
- `createToolResultStopMessage(toolUseID)`
- `createSystemMessage(content, level, toolUseID, preventContinuation)`
- `createPermissionRetryMessage(commands)`
- `createBridgeStatusMessage(url, upgradeNudge)`
- `createScheduledTaskFireMessage(content)`
- `createStopHookSummaryMessage(...)`
- `createTurnDurationMessage(durationMs, budget, messageCount)`
- `createAwaySummaryMessage(content)`
- `createMemorySavedMessage(writtenPaths)`
- `createAgentsKilledMessage()`
- `createApiMetricsMessage(metrics)`
- `createCommandInputMessage(content)`
- `createCompactBoundaryMessage(trigger, preTokens, ...)`
- `createMicrocompactBoundaryMessage(trigger, preTokens, tokensSaved, ...)`
- `createSystemAPIErrorMessage(error, retryInMs, retryAttempt, maxRetries)`
- `createToolUseSummaryMessage(summary, precedingToolUseIds)`

**Private helpers:**
- `baseCreateAssistantMessage({content, isApiErrorMessage, ...})`
- `createToolResultMessage(tool, toolUseResult)` (used by messageAttachments)
- `createToolUseMessage(toolName, input)` (used by messageAttachments)

**Internal imports needed:** `SYNTHETIC_MODEL`, `CANCEL_MESSAGE`, `INTERRUPT_MESSAGE`, `INTERRUPT_MESSAGE_FOR_TOOL_USE`, `NO_CONTENT_MESSAGE` from constants
**Depended on by:** messageNormalization, messageMerging, messageAttachments, messageStream

---

### 3. `messageNormalization.ts` (~1,200 lines)

**Exports:**
- `normalizeMessages(messages)` (4 overloads)
- `normalizeMessagesForAPI(messages, tools)`
- `normalizeContentFromAPI(contentBlocks, tools, agentId)`
- `deriveUUID(parentUUID, index)`
- `deriveShortMessageId(uuid)`

**Private helpers (stay in this module):**
- `isSyntheticApiErrorMessage(message)`
- `stripUnavailableToolReferencesFromUserMessage(message, availableToolNames)`
- `appendMessageTagToUserMessage(message)`
- `contentHasToolReference(content)`
- `ensureSystemReminderWrap(msg)`
- `smooshSystemReminderSiblings(messages)`
- `sanitizeErrorToolResultContent(messages)`
- `relocateToolReferenceSiblings(messages)`
- `normalizeUserTextContent(a)`
- `filterTrailingThinkingFromLastAssistant(messages)`
- `ensureNonEmptyAssistantContent(messages)`
- `mergeAdjacentUserMessages(msgs)` (only used within normalizeMessagesForAPI)

**Internal imports needed:** messageConstants, messageCreation, messageMerging, messageFiltering, messageUtilities
**Note:** This is the most complex module. Most private helpers are only used within `normalizeMessagesForAPI` and should stay co-located.

---

### 4. `messageMerging.ts` (~350 lines)

**Exports:**
- `mergeUserMessagesAndToolResults(a, b)`
- `mergeAssistantMessages(a, b)`
- `mergeUserMessages(a, b)`
- `mergeUserContentBlocks(a, b)`

**Private helpers:**
- `hoistToolResults(content)`
- `joinTextAtSeam(a, b)`
- `smooshIntoToolResult(tr, blocks)`
- `normalizeUserTextContent(a)` (shared with normalization - must be exported or duplicated)
- `isToolResultMessage(msg)` (used by normalization merging logic)

**Internal imports needed:** messageConstants (NO_CONTENT_MESSAGE via constants/messages), toolSearch utils
**Depended on by:** messageNormalization, messageFiltering

---

### 5. `messageLookups.ts` (~650 lines)

**Exports:**
- `MessageLookups` (type)
- `buildMessageLookups(normalizedMessages, messages)`
- `resetMessageLookupsCache()`
- `EMPTY_LOOKUPS`
- `EMPTY_STRING_SET`
- `buildSubagentLookups(messages)`
- `getSiblingToolUseIDsFromLookup(message, lookups)`
- `getProgressMessagesFromLookup(message, lookups)`
- `hasUnresolvedHooksFromLookup(toolUseID, hookEvent, lookups)`
- `getToolUseIDs(normalizedMessages)`
- `getToolResultIDs(normalizedMessages)`
- `getSiblingToolUseIDs(message, messages)`
- `hasUnresolvedHooks(messages, toolUseID, hookEvent)`
- `reorderMessagesInUI(messages, syntheticStreamingToolUseMessages)`
- `reorderAttachmentsForAPI(messages)`

**Private helpers:**
- `IncrementalLookupCache` (type)
- `_lookupCache` (module state)
- `_processNewMessages(cache, messages, fromIndex)`
- `_processNewNormalizedMessages(cache, normalizedMessages, fromIndex)`
- `_recomputeOrphans(cache, normalizedMessages, messages)`
- `_fullRebuild(normalizedMessages, messages)`
- `isHookAttachmentMessage(message)` (also used by normalization - needs export)
- `getInProgressHookCount(messages, toolUseID, hookEvent)`
- `getResolvedHookCount(messages, toolUseID, hookEvent)`

**Internal imports needed:** messageUtilities (getToolUseID), messageConstants
**Depended on by:** messageNormalization (reorderAttachmentsForAPI)

---

### 6. `messageFiltering.ts` (~500 lines)

**Exports:**
- `filterUnresolvedToolUses(messages)`
- `filterWhitespaceOnlyAssistantMessages(messages)` (3 overloads)
- `filterOrphanedThinkingOnlyMessages(messages)` (3 overloads)
- `stripSignatureBlocks(messages)`
- `stripAdvisorBlocks(messages)`
- `ensureToolResultPairing(messages)`
- `stripToolReferenceBlocksFromUserMessage(message)`
- `stripCallerFieldFromAssistantMessage(message)`

**Private helpers:**
- `hasOnlyWhitespaceTextContent(content)`
- `isThinkingBlock(block)`

**Internal imports needed:** messageConstants (SYNTHETIC_TOOL_RESULT_PLACEHOLDER, NO_CONTENT_MESSAGE), messageCreation (createUserMessage), messageMerging (mergeUserMessages)
**Depended on by:** messageNormalization

---

### 7. `messageUtilities.ts` (~350 lines)

**Exports:**
- `extractTag(html, tagName)`
- `isNotEmptyMessage(message)`
- `isEmptyMessageText(text)`
- `stripPromptXMLTags(content)`
- `getToolUseID(message)`
- `getAssistantMessageText(message)`
- `getUserMessageText(message)`
- `textForResubmit(msg)`
- `extractTextContent(blocks, separator)`
- `getContentText(content)`
- `wrapInSystemReminder(content)`
- `wrapMessagesInSystemReminder(messages)`
- `wrapCommandText(raw, origin)`
- `isSystemLocalCommandMessage(message)`
- `shouldShowUserMessage(message, isTranscriptMode)`
- `isThinkingMessage(message)`
- `countToolCalls(messages, toolName, maxCount)`
- `hasSuccessfulToolCall(messages, toolName)`
- `getLastAssistantMessage(messages)`
- `hasToolCallsInLastAssistantTurn(messages)`
- `isToolUseRequestMessage(message)`
- `isToolUseResultMessage(message)`
- `isCompactBoundaryMessage(message)`
- `findLastCompactBoundaryIndex(messages)`
- `getMessagesAfterCompactBoundary(messages, options)`

**Private helpers:**
- `STRIPPED_TAGS_RE` (regex constant)

**Internal imports needed:** messageConstants (INTERRUPT_MESSAGE_FOR_TOOL_USE, NO_CONTENT_MESSAGE)
**Depended on by:** messageLookups, messageNormalization, messageFiltering, messageAttachments

---

### 8. `messageAttachments.ts` (~900 lines)

**Exports:**
- `normalizeAttachmentForAPI(attachment)`

**Private helpers (all stay in this module):**
- `getPlanModeInstructions(attachment)`
- `getPlanModeV2Instructions(attachment)`
- `getPlanModeInterviewInstructions(attachment)`
- `getPlanModeV2SparseInstructions(attachment)`
- `getPlanModeV2SubAgentInstructions(attachment)`
- `getAutoModeInstructions(attachment)`
- `getAutoModeFullInstructions()`
- `getAutoModeSparseInstructions()`
- `getPlanPhase4Section()`
- `getPlanModeV2AgentCount()` (delegated import)
- `getReadOnlyToolNames()`

**Internal imports needed:** messageCreation (createUserMessage, createToolResultMessage, createToolUseMessage), messageUtilities (wrapInSystemReminder, wrapMessagesInSystemReminder, wrapCommandText), messageConstants (PLAN_PHASE4_CONTROL)
**Note:** `createToolResultMessage` and `createToolUseMessage` are currently private in messages.ts but only used by normalizeAttachmentForAPI. They should move to this module or be exported from messageCreation.

---

### 9. `messageStream.ts` (~200 lines)

**Exports:**
- `StreamingToolUse` (type)
- `StreamingThinking` (type)
- `handleMessageFromStream(message, onMessage, onUpdateLength, ...)`

**Internal imports needed:** messageConstants (none directly), external types only
**Depended on by:** Few callers (REPL, bridge)

---

### 10. `messages.ts` (barrel, ~120 lines)

Re-exports everything from all modules above:
```ts
export * from './messageConstants.js'
export * from './messageCreation.js'
export * from './messageNormalization.js'
export * from './messageMerging.js'
export * from './messageLookups.js'
export * from './messageFiltering.js'
export * from './messageUtilities.js'
export * from './messageAttachments.js'
export * from './messageStream.js'
```

This ensures **zero breaking changes** for the 107 importing files.

---

## Dependency Graph

```
messageConstants (no internal deps)
    |
    v
messageCreation (depends on: messageConstants)
    |
    v
messageUtilities (depends on: messageConstants)
    |
    +---> messageLookups (depends on: messageUtilities, messageConstants)
    |
    +---> messageMerging (depends on: messageConstants)
    |
    +---> messageFiltering (depends on: messageConstants, messageCreation, messageMerging)
    |
    +---> messageAttachments (depends on: messageCreation, messageUtilities, messageConstants)
    |
    v
messageNormalization (depends on: ALL above modules)
    |
messageStream (depends on: external types only)
```

**No circular dependencies** - the graph is a DAG. `messageNormalization` is the sink node depending on everything else. `messageConstants` is the source node with no internal dependencies.

---

## Extraction Order

Extract in dependency order (most independent first):

### Commit 1: `messageConstants.ts`
- Extract all constants, sentinel values, and constant-related functions
- Lines 176-300 approximately
- Risk: **LOW** - pure values, no complex logic
- Shared private constants (`MEMORY_CORRECTION_HINT`, `AUTO_MODE_REJECTION_PREFIX`, `TOOL_REFERENCE_TURN_BOUNDARY`) need to be exported or co-located with their consumers

### Commit 2: `messageUtilities.ts`
- Extract text utilities, type guards, content helpers
- Scattered throughout the file (extractTag, isNotEmpty, getToolUseID, wrapInSystemReminder, etc.)
- Risk: **LOW** - mostly pure functions with simple signatures

### Commit 3: `messageCreation.ts`
- Extract all `create*` factory functions
- Lines 355-468 (baseCreateAssistantMessage through createToolResultStopMessage), 4469-4737 (system message creators)
- Risk: **LOW** - factory functions with no complex inter-dependencies

### Commit 4: `messageMerging.ts`
- Extract merge functions and their helpers (hoistToolResults, joinTextAtSeam, smooshIntoToolResult)
- Lines 2497-2772 approximately
- Risk: **MEDIUM** - `smooshIntoToolResult` is used by both merging and normalization; `normalizeUserTextContent` is shared

### Commit 5: `messageLookups.ts`
- Extract lookup building, caching, reordering
- Lines 855-1646 approximately (reorderMessagesInUI, all lookup functions)
- Risk: **MEDIUM** - contains module-level mutable state (`_lookupCache`), `isHookAttachmentMessage` is shared

### Commit 6: `messageFiltering.ts`
- Extract all filter/strip functions
- Lines 2878+ (filterUnresolvedToolUses), 4897-5233 (thinking/whitespace/signature filters), 5267-5597 (ensureToolResultPairing)
- Risk: **MEDIUM** - `ensureToolResultPairing` is complex and interacts with smoosh/merge logic

### Commit 7: `messageAttachments.ts`
- Extract `normalizeAttachmentForAPI` and all plan-mode/auto-mode instruction builders
- Lines 3267-4420 approximately
- Risk: **LOW** - self-contained block, only calls into creation and utility functions

### Commit 8: `messageStream.ts`
- Extract `handleMessageFromStream` and streaming types
- Lines 3046-3226
- Risk: **LOW** - self-contained, depends only on external types

### Commit 9: `messageNormalization.ts` + barrel `messages.ts`
- Move remaining normalization logic into its own module
- Convert original `messages.ts` into a barrel re-export file
- Risk: **MEDIUM** - the normalization pipeline is the most complex piece, many private helpers

---

## Shared Private Functions

These private functions are used by multiple proposed modules and need resolution:

| Function | Used By | Resolution |
|----------|---------|------------|
| `isHookAttachmentMessage` | messageLookups, messageNormalization | Export from messageLookups |
| `normalizeUserTextContent` | messageMerging, messageNormalization | Export from messageMerging |
| `isToolResultMessage` | messageNormalization (merge loop) | Export from messageMerging |
| `isThinkingBlock` | messageFiltering (multiple functions) | Keep private in messageFiltering |
| `smooshIntoToolResult` | messageMerging, messageNormalization (ensureToolResultPairing via smoosh call) | Export from messageMerging |
| `contentHasToolReference` | messageNormalization (relocate, inject) | Keep private in messageNormalization |
| `createToolResultMessage` / `createToolUseMessage` | messageAttachments only | Move to messageAttachments (private) |

---

## Risk Assessment

### Low Risk
- **messageConstants**: Pure values, no logic beyond simple string returns
- **messageCreation**: Factory functions, straightforward extraction
- **messageUtilities**: Pure functions, well-defined signatures
- **messageAttachments**: Self-contained block with clear boundaries
- **messageStream**: Independent of other message logic

### Medium Risk
- **messageMerging**: Shared helpers (`smooshIntoToolResult`, `normalizeUserTextContent`) create coupling with normalization
- **messageLookups**: Module-level mutable state (`_lookupCache`) needs careful handling; `isHookAttachmentMessage` is shared
- **messageFiltering**: `ensureToolResultPairing` is the most complex function in the file (330 lines) and calls into smoosh logic
- **messageNormalization**: Depends on all other modules; the multi-pass pipeline in `normalizeMessagesForAPI` references many helpers

### Mitigation
- Extract shared helpers as named exports (not default) so import paths are explicit
- Run test suite after EACH commit to catch breakage immediately
- The barrel re-export in `messages.ts` ensures no external caller needs changes

---

## Test Strategy

The existing test file (`messages.test.ts`) tests 8 functions:
- `deriveShortMessageId` -> moves to messageNormalization
- `extractTag` -> moves to messageUtilities
- `isEmptyMessageText` -> moves to messageUtilities
- `stripPromptXMLTags` -> moves to messageUtilities
- `wrapInSystemReminder` -> moves to messageUtilities
- `isClassifierDenial` -> moves to messageConstants
- `AUTO_REJECT_MESSAGE` -> moves to messageConstants
- `DONT_ASK_REJECT_MESSAGE` -> moves to messageConstants

The test file imports from `./messages.js` (the barrel), so **no test changes are needed** as long as the barrel re-exports everything.

---

## Commit Structure

```
commit 1: "refactor(messages): extract messageConstants module"
commit 2: "refactor(messages): extract messageUtilities module"
commit 3: "refactor(messages): extract messageCreation module"
commit 4: "refactor(messages): extract messageMerging module"
commit 5: "refactor(messages): extract messageLookups module"
commit 6: "refactor(messages): extract messageFiltering module"
commit 7: "refactor(messages): extract messageAttachments module"
commit 8: "refactor(messages): extract messageStream module"
commit 9: "refactor(messages): extract messageNormalization, convert messages.ts to barrel"
```

Each commit:
1. Creates the new module file with extracted functions
2. Updates `messages.ts` to import and re-export from new module
3. Runs full test suite to verify no breakage
4. No external import paths change (barrel preserves API)
