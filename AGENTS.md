# AGENTS.md - Agentic Coding Guidelines for OllamaFlow

## Build/Lint/Test Commands

```bash
# Development
npm run dev              # Start development server with hot-reload

# Building
npm run build            # Build for production (electron-vite)
npm run build:win        # Build Windows installer
npm run build:unpack     # Build without packaging

# Code Quality
npm run lint             # Run ESLint on all TypeScript files
npm run test             # Run all tests once (Vitest)
npm run test:watch       # Run tests in watch mode
npm run test:ui          # Run tests with Vitest UI
npm run test <pattern>   # Run single test file matching pattern
```

## Project Architecture

- **Electron Structure**: `main/` (main process), `preload/` (preload script), `renderer/` (React UI)
- **State Management**: Zustand stores in `src/renderer/store/`
- **Node System**: Each node type has visual component, properties panel, and executor
- **Path Alias**: `@/*` maps to `src/renderer/*`

## Code Style Guidelines

### Imports
- Use `@/*` path alias for imports from `src/renderer`
- Use explicit `type` imports for TypeScript types: `import type { Foo } from '@/*'`
- Group imports: external deps first, then internal modules, then types
- No semicolons at end of statements

### Naming Conventions
- **Functions/Variables**: camelCase (`getEdgeColorByNodeType`, `workflowStore`)
- **Types/Interfaces**: PascalCase (`NodeType`, `PortDefinition`)
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Files**: kebab-case for components (`execution-panel.tsx`), camelCase for utils
- **React Components**: PascalCase (`FlowCanvas.tsx`)

### Types & Interfaces
- Use strict TypeScript (strict mode enabled)
- Prefer `interface` over `type` for object shapes
- Use explicit return types on exported functions
- Use `unknown` instead of `any` where possible
- Enable `noUnusedLocals` and `noUnusedParameters`

### Formatting
- Single quotes for strings
- Trailing commas in multi-line objects/arrays
- 2 spaces indentation
- Max line length: 100 characters (soft limit)

### Error Handling
- Use try/catch with typed errors
- Return error objects rather than throwing in business logic
- Log errors with context using `console.error()`
- Never expose secrets or API keys in logs

### Comments & Documentation
- Use JSDoc for exported functions and public APIs
- Explain "why" not "what" in comments
- Chinese UI labels are acceptable per project conventions

### Testing
- Tests located in `src/renderer/__tests__/`
- Use Vitest with jsdom environment
- Reset Zustand stores in `beforeEach`
- Mock `window.electronAPI` for IPC calls
- Mock `window.crypto` for UUID generation

### Node Implementation Pattern
When adding new node types:
1. Add type to `NodeType` union in `src/renderer/types/node.ts`
2. Create interface extending `BaseNodeData`
3. Add to `WorkflowNodeData` union
4. Add template to `nodeTemplates`
5. Implement: Visual component, Properties panel, Executor

### Store Safety
- Check node existence before updates: `workflowStore.nodes.some(n => n.id === nodeId)`
- Use guards in async operations that may complete after node deletion
- Use workspace-specific state isolation via `workspaces` Map

### Security
- Never log or commit secrets, API keys, or credentials
- API keys stored via electron-store (main process), not in workspace config
- IPC handlers validate inputs before processing
