
# Agent Instructions

This document provides guidelines for AI agents working in this repository. 

## Development Enviornment
- **OS**: Windows
- Make sure when creating any CLI commands they are for windows

## Development Commands
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Type Check**: `npx tsc --noEmit`
- **Run all tests**: `npm run test:all`
- **Run a single test file**: `tsx tests/test-name.ts` (e.g., `tsx tests/test-limit-orders.ts`)

## Code Style Guidelines

- **Formatting**: Follow existing code style. Use Prettier if configured.
- **Imports**: Use absolute paths with `@/*` alias for `src/`.
- **Types**: Use TypeScript with `strict` mode. Avoid `any` where possible.
- **Naming**: Follow existing conventions (e.g., `camelCase` for variables/functions, `PascalCase` for classes/components).
- **Error Handling**: Use `try...catch` blocks for async operations and API calls.
- **Configuration**: Do not modify `config.json` directly. Use the web UI or API.
- **Security**: Never commit API keys or secrets. `config.json` is in `.gitignore`.
- **Tests**: Add new tests to the `tests/` folder.
