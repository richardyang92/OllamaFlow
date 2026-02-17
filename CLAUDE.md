# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OllamaFlow is a visual workflow builder for Ollama AI models, built as an Electron desktop application. Users can create node-based workflows that integrate with Ollama, read/write files, execute shell commands, and process data through conditional logic.

## Common Commands

```bash
# Development
npm run dev          # Start development server with hot-reload (uses custom scripts/dev.js)

# Building
npm run build        # Build for production (electron-vite)
npm run build:win    # Build Windows installer
npm run build:unpack # Build without packaging (for testing)

# Code Quality
npm run lint         # Run ESLint
```

## Architecture

### Electron Structure
- **main/** - Main process ([index.ts](src/main/index.ts)): Handles IPC, file system operations, shell commands, dialog windows
- **preload/** - Preload script ([index.ts](src/preload/index.ts)): Context bridge exposing typed APIs to renderer via `window.electronAPI`
- **renderer/** - React UI application using Vite

### State Management (Zustand)
Located in [src/renderer/store/](src/renderer/store/):
- **workflow-store.ts** - React Flow nodes/edges, node CRUD operations, dirty tracking
- **execution-store.ts** - Workflow execution state, node results, logs, streaming output
- **workspace-store.ts** - Current workspace, config, recent workspaces list
- **settings-store.ts** - Application settings

### Node Architecture
Each node type has three components:
1. **Visual Component** - [src/renderer/components/nodes/](src/renderer/components/nodes/) - React component for canvas display
2. **Properties Panel** - [src/renderer/components/workflow/properties/](src/renderer/components/workflow/properties/) - UI for editing node configuration
3. **Executor** - [src/renderer/engine/nodes/](src/renderer/engine/nodes/) - Runtime behavior implementing `NodeExecutor` interface

Node type definitions are in [src/renderer/types/node.ts](src/renderer/types/node.ts). To add a new node type:
1. Add type to `NodeType` union
2. Create interface extending `BaseNodeData`
3. Add to `WorkflowNodeData` union
4. Add template to `nodeTemplates`
5. Implement the three components above

### Workflow Execution
[executor.ts](src/renderer/engine/executor.ts) contains:
- `WorkflowExecutor` class - Executes nodes in topological order
- `getExecutionOrder()` - BFS traversal starting from trigger/zero-in-degree nodes
- `buildInputContext()` - Maps outputs from connected nodes to inputs via handles
- `interpolateVariables()` - Replaces `{{variable}}` patterns in node properties
- Node executor registry - Maps `NodeType` to `NodeExecutor` instances

Node executors receive an `ExecutionContext` with:
- `workspacePath`, `ollamaHost` - Configuration
- `variables` - Accumulated outputs from previous nodes
- `userInputValues` - Values collected at workflow start
- `onStream()` - For streaming node output (e.g., Ollama responses)
- `onLog()` - Add entries to execution log

### Variable Interpolation
Syntax: `{{variableName}}` supports dot notation for nested access (`{{node.field}}`). Variables are resolved from:
1. Accumulated outputs from previous nodes (in `context.variables`)
2. Current node's input context (from connected edges)
3. User input values (if defined)

### Key Components
- [FlowCanvas.tsx](src/renderer/components/workflow/FlowCanvas.tsx) - Main canvas using @xyflow/react
- [NodePalette.tsx](src/renderer/components/workflow/NodePalette.tsx) - Draggable node creation
- [PropertiesPanel.tsx](src/renderer/components/workflow/PropertiesPanel.tsx) - Selected node configuration
- [ExecutionPanel.tsx](src/renderer/components/workflow/ExecutionPanel.tsx) - Execution logs and node status
- [Toolbar.tsx](src/renderer/components/workflow/Toolbar.tsx) - Workflow controls (run, save, settings)

### IPC Communication Pattern
Renderer calls main process via `window.electronAPI`:
- `workspace:*` - Workspace initialization, config/workflow persistence
- `file:*` - File read/write/list operations (relative to workspace)
- `command:*` - Shell command execution with timeout
- `recent:*` - Recent workspace list (stored via electron-store)

All IPC handlers in main process are in [src/main/index.ts](src/main/index.ts).

## Important Implementation Notes

### Node Deletion Safety
Recent commits address issues with updating deleted nodes during execution. When modifying stores that interact with workflow nodes:
1. Check node existence before updating: `workflowStore.nodes.some(n => n.id === nodeId)`
2. Use guards in async operations that may complete after node deletion
3. The workflow store's `updateNodeData()` method now includes this safety check

### Edge Styling
Edges are colored by source node type (see `getEdgeColorByNodeType()` in workflow-store.ts). Custom edge component [AnimatedEdge.tsx](src/renderer/components/workflow/edges/AnimatedEdge.tsx) handles animated edges during execution.

### Conditional Execution (If Nodes)
The `if` node type evaluates expressions and routes execution through its `true` or `false` output handles. The executor uses JavaScript's `Function` constructor to safely evaluate the conditional expression against the input context.

### Workspace Storage
Workspaces are folders containing `.ollamaflow/` directory:
- `config.json` - Workspace configuration (Ollama host, default model)
- `workflow.json` - Node/edge data and viewport state
- `cache/` - Runtime cache directory

## Type System
- Path alias: `@/*` maps to `src/renderer/*`
- Strict TypeScript enabled with strict null checks
- All electronAPI types are duplicated in preload script for type safety in renderer

## Data Flow Through Ports
Each node defines `PortDefinition` objects for inputs/outputs with:
- `dataType` - Type annotation ('string', 'number', 'boolean', 'object', 'array', 'any')
- `required` / `multiple` - Port constraints
- Handles map outputs from source nodes to inputs on target nodes via `buildInputContext()`

## UI Localization
The application UI uses Chinese localization throughout:
- Node labels, descriptions, and log messages are in Chinese
- Example: "Ollama 对话" (Ollama Chat), "读取文件" (Read File)

## Testing
No test framework is currently configured. When adding tests, you'll need to set up a test runner (e.g., Vitest for the renderer process).
