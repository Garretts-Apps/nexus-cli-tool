# TODO Audit

Generated: 2026-04-04
Total markers: **406** across 169 files in `src/`

## Summary by Type

| Marker     | Count |
|------------|-------|
| DEPRECATED | 271   |
| TODO       | 138   |
| FIXME      | 0     |
| HACK       | 0     |

---

## DEPRECATED Markers (271)

All `DEPRECATED` markers are symbol-name suffixes on exported functions/types that have been renamed but kept for backward compatibility. No standalone `// DEPRECATED` comments exist.

### Top DEPRECATED symbols by usage

| Symbol                          | Usages |
|---------------------------------|--------|
| `getSettings_DEPRECATED`        | 124    |
| `splitCommand_DEPRECATED`       | 41     |
| `writeFileSync_DEPRECATED`      | 27     |
| `execSyncWithDefaults_DEPRECATED` | 17   |
| `execSync_DEPRECATED`           | 15     |
| `bashCommandIsSafe_DEPRECATED`  | 9      |
| `writeFileSyncAndFlush_DEPRECATED` | 8   |
| `commands_DEPRECATED`           | 8      |
| `bashCommandIsSafeAsync_DEPRECATED` | 5  |
| `getFeatureValue_DEPRECATED`    | 4      |
| `isUnsafeCompoundCommand_DEPRECATED` | 3 |
| `renderPreviousOutput_DEPRECATED` | 2    |
| `RegexParsedCommand_DEPRECATED` | 2      |

**Action needed:** `getSettings_DEPRECATED` (124 usages) is the highest-priority migration target. Most other symbols have replacement functions already defined; callers just haven't been updated.

---

## TODO Markers (138)

### Category Breakdown

#### Migration / Cleanup TODOs (future-work, marked by owner)
- `src/hooks/useBackgroundTaskNavigation.ts:245` — `onKeyDown-migration`: remove once REPL passes handleKeyDown
- `src/hooks/useHistorySearch.ts:273` — `onKeyDown-migration`: remove once PromptInput passes handleKeyDown
- `src/hooks/useSearchInput.ts:355` — `onKeyDown-migration`: remove once all consumers pass handleKeyDown
- `src/hooks/useTypeahead.tsx:1367` — `onKeyDown-migration`: remove once PromptInput passes handleKeyDown
- `src/hooks/useVoiceIntegration.tsx:652,670` — `onKeyDown-migration`: remove shims once REPL passes handleKeyDown
- `src/keybindings/shortcutFormat.ts:9` — `keybindings-migration`: remove fallback after migration complete
- `src/keybindings/useShortcutDisplay.ts:9` — `keybindings-migration`: remove fallback after migration complete
- `src/utils/messages/systemInit.ts:20` — `next-minor`: remove SDK consumer translation once migrated
- `src/components/permissions/ExitPlanModePermissionRequest/ExitPlanModePermissionRequest.tsx:195` — delete branch after moving to V2

#### Architecture / Refactor TODOs
- `src/utils/config.ts:176` — `emacs` kept for backward compat, remove after a few releases
- `src/utils/config.ts:224` — rename `primaryApiKey` field comment
- `src/state/AppState.tsx:23` — remove re-exports once all callers import directly
- `src/services/compact/compact.ts:1690` — refactor to use `isMemoryFilePath()` for consistency
- `src/tools/FileEditTool/utils.ts:360` — unify snippet logic
- `src/utils/attachments.ts:740,763` — compute attachments upstream / as user types
- `src/utils/attachments.ts:2945` — compute upstream
- `src/utils/bash/ast.ts:2559` — remove once downstream path validation operates on argv
- `src/utils/bash/commands.ts:630` — refactor once AST parsing stable
- `src/components/permissions/PermissionRequest.tsx:145` — move to `Tool.renderPermissionRequest`

#### Feature TODOs (tracked issues)
- `src/commands/review/reviewRemote.ts:7` — `#22051`: pass useBundleMode once landed
- `src/commands/ultraplan.tsx:364` — `#23985`: replace `registerRemoteAgentTask` + `startDetachedPoll`
- `src/tasks/RemoteAgentTask/RemoteAgentTask.tsx:459` — `#23985`: fold ExitPlanModeScanner into poller
- `src/services/api/withRetry.ts:94` — `ANT-344`: keep-alive via SystemAPIErrorMessage is a stopgap
- `src/services/mcp/xaa.ts:133,176` — upstream mix-up protection to SDK
- `src/services/mcp/xaa.ts:229` — `xaa-ga`: consult `token_endpoint_auth_methods_supported`
- `src/services/mcp/auth.ts:1743` — `xaa-ga`: add cross-process lockfile before GA

#### Security / Auth TODOs
- `src/utils/auth.ts:1090,1142` — migrate credential storage to `SecureStorage`
- `src/utils/secureStorage/index.ts:14` — add libsecret support for Linux
- `src/utils/http.ts:85` — will fail if API key is set to an LLM Gateway key
- `src/commands/mcp/xaaIdpCommand.ts:162` — read JWT from stdin instead of argv

#### Performance / Caching TODOs
- `src/services/api/client.ts:232` — cache `GoogleAuth` / `AuthClient` instance
- `src/services/mcp/client.ts:590` — memoization increases complexity, unclear if it helps
- `src/services/diagnosticTracking.ts:56` — do not cache `mcpClient` since it can change
- `src/services/lsp/LSPServerManager.ts:374` — integrate with compact; call `closeFile()` on compact

#### Type Safety TODOs
- `src/QueryEngine.ts:545` / `src/hooks/useReplBridge.tsx:310` — avoid type casts
- `src/cli/print.ts:2921` — use readonly types instead of cast
- `src/utils/promptCategory.ts:21` — avoid cast
- `src/entrypoints/mcp.ts:136` — validate input types with zod
- `src/utils/messageNormalization.ts:700` — recursive fields can still be stringified

#### UI / UX TODOs
- `src/components/Message.tsx:35` — remove spacing hack, leave to consumer
- `src/components/ResumeTask.tsx:168` — include branch name when API returns it
- `src/components/Spinner.tsx:289` — fix terminal-too-small layout in Ink
- `src/components/ScrollKeybindingHandler.tsx:568` — search keybinding (`/`, n/N)
- `src/components/Settings/Config.tsx:263,1094` — add MCP servers; make proper messages
- `src/tools/FileReadTool/UI.tsx:78` — render recursively

#### Miscellaneous TODOs
- `src/commands/mcp/mcp.tsx:10` — remove context hack once toggleMcpServer is refactored
- `src/main.tsx:2390` — consolidate prefetches into single bootstrap request
- `src/screens/REPL.tsx:3107,3124,4113` — simplify onSubmit routing; remove content block branch; fix unnamed issue
- `src/utils/plugins/pluginLoader.ts:3242` — clear installed plugins cache when manager is implemented
- `src/utils/plugins/marketplaceManager.ts:1619` — implement npm package support
- `src/skills/bundled/scheduleRemoteAgents.ts:31` — before public ship: `/v1/mcp_servers` endpoint
- `src/commands/ultraplan.tsx:20` — OAuth token may go stale over 30min poll

#### Informational (not actionable)
- `src/constants/outputStyles.ts:84-124` — `TODO(human)` markers in example prompt templates (intentional)
- `src/tools/TodoWriteTool/constants.ts:1` — tool name constant (`TODO_WRITE_TOOL_NAME`)
- `src/constants/prompts.ts`, `src/constants/tools.ts` — imports of `TODO_WRITE_TOOL_NAME`
- `src/utils/attachments.ts:253` — `TODO_REMINDER_CONFIG` constant definition

---

## Files with Most Markers

| File                                         | Count |
|----------------------------------------------|-------|
| `src/utils/attachments.ts`                   | 13    |
| `src/utils/auth.ts`                          | 12    |
| `src/utils/sandbox/sandbox-adapter.ts`       | 10    |
| `src/tools/BashTool/readOnlyValidation.ts`   | 9     |
| `src/constants/outputStyles.ts`              | 9     |
| `src/utils/plugins/installedPluginsManager.ts` | 8   |
| `src/utils/hooks.ts`                         | 7     |
| `src/utils/execSyncWrapper.ts`               | 7     |
| `src/tools/BashTool/bashCommandHelpers.ts`   | 7     |
| `src/commands/plugin/ManagePlugins.tsx`       | 7     |

---

## Priority Recommendations

1. **High**: Migrate away from `getSettings_DEPRECATED` (124 call sites) — largest single migration effort
2. **High**: Migrate `splitCommand_DEPRECATED` (41 sites) and `writeFileSync_DEPRECATED` (27 sites)
3. **Medium**: Resolve `onKeyDown-migration` TODOs (5 hooks) — blocked on REPL/PromptInput refactor
4. **Medium**: Address security TODOs in `src/utils/auth.ts` (SecureStorage migration)
5. **Low**: Remaining architectural TODOs are self-contained and non-blocking
6. **Informational**: `TODO(human)` markers in `outputStyles.ts` are intentional prompt templates — do not remove
