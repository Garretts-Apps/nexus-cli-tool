# CODE-006: TODO Marker Backlog

Audit of 114 TODO markers in src/ (excluding test files and constants/outputStyles.ts).
Generated as part of the ARCH-002 refactoring plan. These are tracked here as a backlog
rather than resolved inline — each item represents intentional future work, not a bug.

## Summary

| Category | Count |
|----------|-------|
| Ink layer (upstream dependency) | 4 |
| Keybinding migration | 2 |
| Plugin system future work | 6 |
| Tool improvements | 5 |
| Auth/secure storage migration | 3 |
| Shell/bash improvements | 3 |
| Message/attachment improvements | 5 |
| REPL.tsx cleanup | 3 |
| Other (misc cleanup, future features) | 83 |

## High-Priority Items (should be resolved in next sprint)

- `src/tools/AgentTool/forkSubagent.ts:154` — `[tool_result, text]` wire pattern issue (smoosh TODO)
- `src/utils/processUserInput/processBashCommand.tsx:48` — Clean up hack in bash command processing
- `src/utils/config.ts:1616` — Fix upstream issue
- `src/screens/REPL.tsx:4132` — Fix noted with TODO

## Medium-Priority Items (next quarter)

- `src/Tool.ts:398` — Make `description` required on TungstenTool
- `src/tasks/RemoteAgentTask/RemoteAgentTask.tsx:459` — Fold ExitPlanModeScanner into poller (#23985)
- `src/keybindings/shortcutFormat.ts:9` — Remove fallback param after keybinding migration
- `src/keybindings/useShortcutDisplay.ts:9` — Remove fallback param after keybinding migration
- `src/utils/auth.ts:1079,1131` — Migrate to SecureStorage
- `src/utils/secureStorage/index.ts:14` — Add libsecret support for Linux
- `src/utils/thinking.ts:88` — Add probing support for unknown models
- `src/utils/messages/systemInit.ts:20` — Remove translation after SDK consumers migrate

## Low-Priority Items (tech debt backlog)

- `src/ink/render-to-screen.ts:162` — Refactor codeUnitToCell to shared helper
- `src/ink/events/input-event.ts:50,95` — Remove deprecated APIs in next major version
- `src/ink/screen.ts:688` — Document SpacerHead cells when soft-wrapping is implemented
- `src/main.tsx:2390` — Consolidate prefetches into single bootstrap request
- `src/tools/FileEditTool/utils.ts:360` — Unify snippet logic
- `src/tools/FileReadTool/UI.tsx:78` — Render recursively
- `src/utils/plugins/schemas.ts:432,463,1158,1159` — Allow globs and gist/single file support
- `src/utils/plugins/pluginLoader.ts:3242` — Clear installed plugins cache when implemented
- `src/utils/plugins/marketplaceManager.ts:1619` — Implement npm package support
- `src/utils/api.ts:565` — Generalize to all tools
- `src/utils/attachments.ts:740,763,2074,2945` — Attachment compute improvements
- `src/utils/messageNormalization.ts:700` — Patch recursive field stringification
- `src/utils/bash/commands.ts:630` — Refactor/simplify after AST parsing
- `src/utils/bash/ast.ts:2559` — Remove after downstream path validation uses argv
- `src/cli/print.ts:1146,1878,2921` — Various cleanup items
- `src/state/AppState.tsx:23` — Remove re-exports after callers migrate
- `src/screens/REPL.tsx:3126,3143` — Simplify once onSubmit supports ContentBlockParam arrays
