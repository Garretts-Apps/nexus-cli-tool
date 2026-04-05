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

## License

This project is proprietary software.

## Support

For issues, questions, or contributions, please refer to the project documentation or contact the development team.
