# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OllamaFlow is a visual workflow builder for Ollama AI models, built as an Electron desktop application. Users can create node-based workflows that integrate with Ollama, read/write files, execute shell commands, and process data through conditional logic.

## Common Commands

```bash
# Development
npm run dev          # Start development server with hot-reload (uses custom scripts/dev.js)
                      # Note: The dev script unsets ELECTRON_RUN_AS_NODE for environments like VSCode

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
  - **main/browser/** - Playwright browser automation ([index.ts](src/main/browser/index.ts), [types.ts](src/main/browser/types.ts)): `BrowserManager` class for headless browser control
- **preload/** - Preload script ([index.ts](src/preload/index.ts)): Context bridge exposing typed APIs to renderer via `window.electronAPI`
- **renderer/** - React UI application using Vite

### State Management (Zustand)
Located in [src/renderer/store/](src/renderer/store/):
- **workflow-store.ts** - React Flow nodes/edges, node CRUD operations, dirty tracking
- **execution-store.ts** - Workflow execution state, node results, logs, streaming output
  - Supports multi-workspace execution state isolation via `workspaces` Map
  - Each workspace maintains independent: context, logs, streamingOutput, reactAgentStates, planStates, queueStates, pendingQuestion
  - Use `switchWorkspaceContext()` to restore workspace-specific state when switching between workspaces
- **workspace-store.ts** - Current workspace, config, recent workspaces list, app page navigation
- **settings-store.ts** - Application settings

**App Pages**: The application uses a `currentPage` state in workspace-store to navigate between:
- `'welcome'` - Welcome screen with recent workspaces
- `'wizard'` - New project creation wizard
- `'editor'` - Workflow editor (main UI)

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
- `shouldExecuteNode()` - Checks if a node should execute based on smart router branch activation

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
- [NewProjectWizard.tsx](src/renderer/pages/NewProjectWizard.tsx) - Multi-step wizard for creating new projects with templates

### Project Wizard
The new project wizard ([NewProjectWizard.tsx](src/renderer/pages/NewProjectWizard.tsx)) provides a guided 4-step flow:
1. **Location** - Select project folder path
2. **Basic Info** - Set project name and description
3. **AI Configuration** - Choose AI backend (Ollama or OpenAI-compatible), configure API endpoint and model
4. **Confirm** - Select a project template and create

**Available Templates** ([templates.ts](src/renderer/components/wizard/templates.ts)):
- `empty` - Blank project with no nodes
- `basic-chat` - Input → Ollama Chat → Output
- `agent` - Input → ReAct Agent → Output

Templates include pre-configured nodes with sensible defaults for the selected model.

### IPC Communication Pattern
Renderer calls main process via `window.electronAPI`:
- `workspace:*` - Workspace initialization, config/workflow persistence
- `file:*` - File read/write/list operations (relative to workspace), includes `file:readImage` for base64 image data
- `command:*` - Shell command execution with timeout
- `http:*` - HTTP fetch requests (main process bypasses CORS)
- `browser:*` - Playwright browser automation (init, navigate, click, type, scroll, screenshot, getContent, evaluate, wait, tab management)
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

### Loop Node Implementation
Loop nodes support three modes: `count` (fixed iterations), `array` (iterate over array items), and `condition` (while-style with expression). Body nodes (nodes inside the loop) are identified via:
1. React Flow's `parentId` property (child nodes have `parentId` set to the loop node's id), or
2. Fallback to `data.bodyNodeIds` array stored in the loop node's data

Loop variables available to body nodes include: `{{loopVariable}}` (current item), `{{indexVariable}}` (index), `isFirst`, `isLast`, and `count`.

### Workspace Storage
Workspaces are folders containing `.ollamaflow/` directory:
- `config.json` - Workspace configuration (Ollama host, default model)
- `workflow.json` - Node/edge data and viewport state
- `cache/` - Runtime cache directory

Application-level settings (e.g., recent workspaces) are persisted via **electron-store** in the main process.

### AI Backend Configuration
The application supports multiple AI backends configured per-workspace in `config.json`:
- **Ollama** (default): `http://localhost:11434` - Local LLM runtime
- **OpenAI-compatible APIs**: Any service compatible with OpenAI's API format (OpenAI, DeepSeek, Azure OpenAI, vLLM, etc.)

For OpenAI-compatible APIs, API keys are stored securely via electron-store (not in the workspace folder). Each node can specify its own model, or use the workspace default. Chat executors support streaming responses via the `onStream()` callback in `ExecutionContext`.

### Image Node
The `image` node supports two source types via `sourceType` property:
- `'input'` - Uses the value from connected input edge
- `'variable'` - Resolves `variableName` from accumulated workflow variables (supports `{{variable}}` interpolation)

This pattern is also used by the `output` node for flexible data sourcing.

## Type System
- Path alias: `@/*` maps to `src/renderer/*`
- Strict TypeScript enabled with strict null checks
- All electronAPI types are duplicated in preload script for type safety in renderer
- OpenAI client types are in [openai-client.ts](src/renderer/engine/openai-client.ts):
  - `OpenAIMessage` - Message format with role, content, tool_calls, and optional `reasoning_content` (for DeepSeek reasoner models)
  - `OpenAITool` / `OpenAIToolCall` - Function calling types
  - `OpenAIChatOptions` / `OpenAIChatResponse` - Request/response types
  - `parseToolCallArgs()` - Safe JSON parsing for tool arguments

## Styling
- **Tailwind CSS** for utility-first styling
- **tailwind-merge** + **clsx** pattern via `cn()` utility for conditional class merging
- **Framer Motion** for animations (used in nodes and UI transitions)

## Data Flow Through Ports
Each node defines `PortDefinition` objects for inputs/outputs with:
- `dataType` - Type annotation ('string', 'number', 'boolean', 'object', 'array', 'any')
- `required` / `multiple` - Port constraints
- Handles map outputs from source nodes to inputs on target nodes via `buildInputContext()`

**Handle Naming Convention**: Edges use `sourceHandle` and `targetHandle` to map specific output ports to input ports. When connecting nodes:
- `sourceHandle` should match a port ID in the source node's `outputs` array
- `targetHandle` defaults to `'input'` but can match any port ID in the target's `inputs` array
- The executor retrieves the field matching `sourceHandle` from the source node's output object

### ReAct Agent Node
The `reactAgent` node type implements a Reasoning + Acting pattern using Function Calling API:
- **Executor**: [react-agent.ts](src/renderer/engine/nodes/react-agent.ts) - Implements the think-act-observe loop
- **Tools**: [engine/tools/index.ts](src/renderer/engine/tools/index.ts) - Built-in tools (todos, readFile, writeFile, executeCommand, httpRequest)

The agent maintains state via `ReActExecutionState` in the execution store, tracking:
- Current iteration and max iterations
- Steps with thought/action/observation for each iteration
- Final answer when task completes

**Loop Detection**: The executor includes `detectLoop()` to prevent infinite loops by monitoring repeated actions and blocking problematic patterns (e.g., excessive writeFile calls, over-planning with todos).

**Tool Schema**: Tools are converted to the provider's function format. Each tool defines parameters with JSON schema for type validation.

**Browser Automation Tools**: The agent can use Playwright-based browser tools (navigate, click, type, scroll, screenshot, getContent, evaluate, wait). Browser sessions are managed per-workspace via `BrowserManager` singleton in [src/main/browser/index.ts](src/main/browser/index.ts). Sessions are lazy-initialized and persist until explicitly closed or app termination.

**LLM Abstraction Layer**: The ReAct agent uses a provider abstraction layer in [src/renderer/engine/react-agent/llm/](src/renderer/engine/react-agent/llm/):
- `ILLMClient` interface - Standard contract for all LLM providers with `chat()`, `createToolResponse()`, `handleRetry()` methods
- `StandardMessage`, `StandardToolCall`, `StandardLLMResponse` - Unified types that abstract provider differences
- Supports `ollama` and `openai` providers via `LLMProvider` type
- Factory pattern for creating provider-specific client instances

When using OpenAI-compatible APIs, the agent stores API keys via electron-store with IPC handlers:
- `openai:getApiKey` - Retrieve stored API key
- `openai:setApiKey` - Store API key
- `openai:deleteApiKey` - Delete stored API key

### Smart Router Node
The `smartRouter` node type uses AI to dynamically route execution to different branches:
- **Executor**: [smart-router.ts](src/renderer/engine/nodes/smart-router.ts) - AI-powered branch selection
- **Branches**: Each branch has `id`, `name`, `description`, and optional `isDefault` flag
- **Output**: Only the selected branch's output port has a value; others are undefined

**Conditional Execution**: The workflow executor tracks active branches via `activeBranches` map. When a smart router selects a branch, only downstream nodes connected to that branch execute; nodes on other branches are skipped with log message "跳过节点（来自未激活的分支）".

**API Key Hierarchy**: For OpenAI-compatible mode, API keys are resolved in order:
1. Node-specific key (`router-{nodeId}`)
2. Workspace default key (`workspace-default`)

**Value Passthrough**: Uses `extractActualValue()` to unwrap single-field inputs. If input is `{ value: "text" }`, downstream nodes receive `"text"` directly instead of the wrapper object.

### Plan Node
The `plan` node type provides AI-powered task planning with optional user clarification:
- **Executor**: [plan.ts](src/renderer/engine/nodes/plan.ts) - Two-phase planning with optional questions
- **Phases**: `analyzing` → `questions` (optional) → `generating` → `complete` / `error`
- **Question Flow**: If the AI determines more information is needed, it generates structured questions that the user must answer before plan generation continues
- **State**: Managed via `PlanExecutionState` in execution store with workspace isolation
- **Question Manager**: [PlanQuestionsManager.tsx](src/renderer/components/workflow/PlanQuestionsManager.tsx) handles the dialog for collecting user answers
- **User Input Hook**: [usePlanState.ts](src/renderer/hooks/usePlanState.ts) - Access plan state respecting workspace context

**Debug Mode**: Like ReAct Agent, supports OpenAI-compatible API for testing/production use.

**API Key Hierarchy**: For OpenAI-compatible mode, API keys are resolved in order:
1. Node-specific key (`plan-{model}`)
2. Workspace default key (`workspace-default`)

### ReAct Agent User Input Interaction
When `enableUserInput` is true, the ReAct agent can pause execution and request user input:
- **Trigger**: Agent calls a special `request_user_input` tool with prompt and optional context
- **State**: Managed via `pendingQuestion` in execution store
- **Dialog**: [ReactAgentInputDialog.tsx](src/renderer/components/nodes/react-agent/ReactAgentInputDialog.tsx) displays the prompt
- **Continuation**: After user submits, `continueReactAgentWithUserInput()` resumes execution with the user's response
- **Integration**: [PlanQuestionsManager.tsx](src/renderer/components/workflow/PlanQuestionsManager.tsx) handles both Plan and ReAct Agent dialogs

### Parallel Execution Nodes (Splitter/Join)
For parallel workflow execution:
- **Splitter** ([splitter.ts](src/renderer/engine/nodes/splitter.ts)): Distributes single input to multiple outputs simultaneously
- **Join** ([join.ts](src/renderer/engine/nodes/join.ts)): Collects outputs from multiple parallel branches into a single object
- **Pattern**: Use `Splitter → [multiple branches] → Join` for parallel processing
- **Failure Strategy**: Splitter node supports `continueOthers` (default) or `failAll` on branch errors

### Queue Node
The `queue` node ([queue.ts](src/renderer/engine/nodes/queue.ts)) manages queued data flow:
- Collects multiple inputs into a queue stored in execution store
- Outputs one item at a time (first-in-first-out)
- Clears queue and outputs current inputs when new data arrives
- State persists per-workspace via `queueStates` Map

### HTTP Request Node
The `httpRequest` node ([http-request.ts](src/renderer/engine/nodes/http-request.ts)) makes HTTP requests:
- Supports GET, POST, PUT, DELETE, PATCH methods
- Configurable headers, query parameters, and body (JSON/text/form)
- Response type handling: JSON (auto-parse) or text
- Timeout configuration with default 30 seconds
- Bypasses CORS by routing through main process (`window.electronAPI.http.fetch`)

### Delay Node
The `delay` node ([delay.ts](src/renderer/engine/nodes/delay.ts)) pauses execution:
- Configurable delay in milliseconds
- Optional passthrough mode to include input in output

### JSON Node
The `json` node ([json.ts](src/renderer/engine/nodes/json.ts)) processes JSON data:
- **parse**: Convert JSON string to object
- **stringify**: Convert object to JSON string (pretty-printed)
- **extract**: Extract nested values using JSONPath-like syntax (supports dot notation and array indices like `items[0].name`)
- **merge**: Merge multiple input objects into one

## UI Localization
The application UI uses Chinese localization throughout:
- Node labels, descriptions, and log messages are in Chinese
- Example: "Ollama 对话" (Ollama Chat), "读取文件" (Read File)

## Testing
No test framework is currently configured. When adding tests, you'll need to set up a test runner (e.g., Vitest for the renderer process).
