# Nexus CLI Tool

A powerful terminal-based IDE and development assistant built with TypeScript and React Ink.

## Features

- **Interactive Terminal UI** - Full-featured terminal interface with syntax highlighting and responsive layouts
- **File Management** - Read, write, edit, and search files with advanced glob and grep support
- **Bash Integration** - Execute commands with full terminal emulation
- **Architecture Support** - Built-in support for multiple coding languages and frameworks
- **Memory Management** - Persistent memory and session state across interactions
- **Tools & Extensibility** - Comprehensive tool ecosystem for development workflows
- **Configuration** - Flexible configuration system for customization

## Quick Start

### Installation

```bash
npm install
```

### Running

```bash
npm start
```

### Testing

```bash
npm test
```

## Project Structure

```
src/
├── commands/          # CLI commands and workflows
├── components/        # React/Ink UI components
├── hooks/            # React hooks
├── services/         # Core services (API, analytics, MCP)
├── tools/            # Tool implementations
├── utils/            # Utility functions
├── types/            # TypeScript type definitions
└── main.tsx          # Application entry point
```

## Development

### Build

```bash
npm run build
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## Technology Stack

- **Runtime**: Bun
- **Language**: TypeScript (strict mode)
- **UI Framework**: React with Ink
- **Testing**: Vitest
- **Build**: Esbuild

## Configuration

Global configuration is stored in `~/.clauderc` and includes settings for:
- API keys and authentication
- User preferences
- Tool permissions
- Session state

Project-level configuration can be specified in `.claude/CLAUDE.md`.

## Contributing

Development follows these practices:
- Write tests for new features
- Maintain TypeScript strict mode compliance
- Follow existing code patterns and conventions
- All 172 tests must pass before committing

## Removed Features

The following features have been removed from this distribution:

### Computer Use (chicago MCP)
- `src/utils/computerUse/` - Computer use session management, Swift loader, MCP server setup, tool rendering, and gate logic
- `src/components/permissions/ComputerUseApproval/` - UI permission approval dialogs for computer use
- `AppState.computerUseMcpState` field in `src/state/AppStateStore.ts` - Session-scoped app allowlist, grant flags, screenshot dims, and display tracking state

These features depended on internal `@ant/computer-use-mcp` and `@ant/computer-use-swift` packages and the `feature('CHICAGO_MCP')` flag.

### Claude in Chrome
- `src/utils/claudeInChrome/` - Chrome native host bridge, MCP server setup, and tool rendering
- `src/skills/bundled/claudeInChrome.ts` - Bundled skill for claude-in-chrome

This feature depended on the internal `@ant/claude-for-chrome-mcp` package.

## License

This project is proprietary software.

## Support

For issues, questions, or contributions, please refer to the project documentation or contact the development team.
