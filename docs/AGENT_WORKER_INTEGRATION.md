# Agent Worker System 集成指南

## 📦 完成的内容

### 1. 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron 主进程                          │
├─────────────────────────────────────────────────────────────┤
│                    渲染进程 (主线程)                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   AgentPage     │  │  react-agent    │  │  Settings    │ │
│  │   (独立Agent)   │  │  (工作流节点)   │  │   Panel      │ │
│  └────────┬────────┘  └────────┬────────┘  └──────────────┘ │
│           │                    │                            │
│  ┌────────▼────────────────────▼────────┐                   │
│  │      useAgent / useAgentWorkerAdapter │                   │
│  │         (React Hooks)                │                   │
│  └────────┬─────────────────────────────┘                   │
│           │                                                  │
│  ┌────────▼────────┐  ┌─────────────────┐                   │
│  │  WorkerPoolManager│  │   Tool Bridge   │                   │
│  │   (Worker 池)     │  │ (electronAPI)  │                   │
│  └────────┬────────┘  └─────────────────┘                   │
│           │                                                  │
├───────────┼──────────────────────────────────────────────────┤
│           │         Worker 线程 (独立)                       │
│  ┌────────▼─────────────────────────────────────────────┐   │
│  │                agent.worker.ts                       │   │
│  │  • LLM API 调用 (fetch)                              │   │
│  │  • Agent 执行循环                                     │   │
│  │  • 上下文压缩                                         │   │
│  │  • 工具依赖分析                                       │   │
│  │  • Todos 管理                                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2. 文件结构

```
src/renderer/engine/
├── workers/
│   ├── types.ts              # Worker 通信类型定义
│   ├── agent.worker.ts       # Worker 执行器 (核心)
│   └── worker-pool.ts        # Worker 池管理器
├── nodes/
│   ├── react-agent.ts        # 原有的 ReAct Agent
│   └── react-agent-worker.ts # Worker 版本的 ReAct Agent
├── tool-bridge.ts            # 工具执行桥接
├── agent-controller.ts       # 主线程控制器
└── agent-worker-system.ts    # 统一导出

src/renderer/hooks/
├── useAgent.ts               # React Hook
└── useAgentWorkerAdapter.ts  # 适配器 Hook

src/renderer/components/agent/
└── WorkerSettingsPanel.tsx   # Worker 设置面板

src/renderer/__tests__/
└── agent-worker.test.ts      # 单元测试
```

### 3. 功能特性

✅ **Worker 池管理**
- 支持多个 Worker 实例 (默认 4 个)
- 自动故障恢复
- 空闲 Worker 超时回收
- 并发执行限制

✅ **优先级队列**
- 支持高/普通/低优先级
- 自动调度执行

✅ **工具执行**
- 在 Worker 中分析工具依赖
- 并行执行独立工具
- 通过主线程桥接 electronAPI

✅ **上下文管理**
- 自动 Token 估算
- 超过阈值时自动压缩
- 支持 LLM 压缩和规则压缩

✅ **流式处理**
- 流式思考内容
- 流式推理内容 (DeepSeek R1)
- 实时状态更新

✅ **向后兼容**
- 原有 API 保持不变
- 可通过配置开关切换
- 渐进式迁移支持

## 🚀 如何启用 Worker 模式

### 方法 1: 通过设置面板

1. 打开 Agent 页面
2. 点击设置按钮 (⚙️)
3. 在工作流列表下方找到 "Worker 模式" 开关
4. 开启开关即可启用

### 方法 2: 通过代码

```typescript
import { setWorkerMode } from '@/engine/nodes/react-agent-worker'

// 启用 Worker 模式
setWorkerMode(true)

// 禁用 Worker 模式
setWorkerMode(false)
```

### 方法 3: 在 React Agent 节点中使用

```typescript
import { executeReactAgentInWorker, shouldUseWorkerMode } from '@/engine/nodes/react-agent-worker'

// 在 react-agent.ts 中
async function executeReAct(...) {
  // 如果启用了 Worker 模式，尝试使用 Worker 执行
  if (shouldUseWorkerMode()) {
    const result = await executeReactAgentInWorker({ node, data, input, context })
    if (result !== null) {
      return result  // Worker 执行成功
    }
    // Worker 返回 null，回退到原有执行方式
  }
  
  // 原有的执行逻辑...
}
```

## 📊 性能对比

### Worker 模式优势

1. **UI 响应性**
   - LLM 调用期间 UI 不会卡顿
   - 工具执行时界面保持流畅
   - 支持多 Agent 并行执行

2. **计算密集型任务**
   - 工具依赖分析不阻塞主线程
   - 上下文压缩在后台进行
   - 循环检测不影响 UI

3. **并发能力**
   - 默认支持 4 个并发 Agent
   - 可配置 Worker 池大小
   - 优先级队列保证重要任务优先执行

### 使用场景建议

| 场景 | 推荐模式 | 原因 |
|------|----------|------|
| 简单对话 | 主线程 | 开销更小 |
| 复杂任务 (多工具) | Worker | 避免 UI 卡顿 |
| 多 Agent 并行 | Worker | 支持并发 |
| 长上下文处理 | Worker | 压缩不阻塞 |
| 需要实时响应 | Worker | UI 保持流畅 |

## 🔧 配置选项

### Worker 池配置

```typescript
import { getWorkerPool } from '@/engine/workers/worker-pool'

const pool = getWorkerPool({
  poolSize: 4,           // Worker 数量 (默认 4)
  maxConcurrent: 4,      // 最大并发数 (默认 4)
  workerIdleTimeout: 300000, // 空闲超时 (毫秒，默认 5 分钟)
})
```

### Agent 配置

```typescript
import { useAgent } from '@/hooks/useAgent'

const { execute, cancel, status, poolStatus } = useAgent({
  sandboxPath: '/path/to/workspace',
  priority: 'high',  // 'high' | 'normal' | 'low'
  onStepStart: (step) => console.log('Step started:', step),
  onThoughtChunk: (stepId, chunk) => console.log('Thinking:', chunk),
  onToolCallsStart: (toolCalls) => console.log('Tools:', toolCalls),
  onComplete: (response, generatedFiles) => console.log('Done:', response),
  onError: (error) => console.error('Error:', error),
})
```

## 🧪 测试

### 单元测试

```bash
npm test -- src/renderer/__tests__/agent-worker.test.ts
```

已通过的测试：
- ✅ 工具桥接 (readFile, writeFile, executeCommand)
- ✅ 错误处理
- ✅ Worker 池初始化

### 手动测试

1. 启动应用
2. 打开 Agent 页面
3. 在设置中启用 Worker 模式
4. 发送测试消息
5. 观察 Worker 池状态

## 📋 已知问题

1. **TypeScript 类型错误**
   - LSP 警告但不影响运行时
   - 主要是类型定义不匹配

2. **Worker 测试限制**
   - Vitest 环境不支持 Web Worker
   - 需要在真实 Electron 环境中测试

3. **继续执行功能**
   - Worker 版本的继续执行需要进一步完善
   - 状态恢复逻辑待优化

## 📝 迁移检查清单

### 对于 AgentPage.tsx

- [x] 导入 `useAgent` hook
- [x] 替换 `IntelligentAgentExecutor` 为适配器
- [ ] 测试流式输出
- [ ] 测试工具调用
- [ ] 测试取消功能
- [ ] 测试继续执行

### 对于 react-agent.ts

- [x] 创建 Worker 版本
- [ ] 集成到原有执行流程
- [ ] 测试工作流节点中的 Agent
- [ ] 验证流式输出
- [ ] 验证工具执行

### 全局

- [ ] 性能对比测试
- [ ] 内存泄漏检查
- [ ] 错误恢复测试
- [ ] 长时间运行稳定性

## 🎯 下一步建议

1. **在真实环境中测试**
   - 启动 Electron 应用
   - 测试完整的 Agent 执行流程
   - 对比 Worker 模式和主线程模式

2. **性能优化**
   - 监控 Worker 内存使用
   - 优化消息传递
   - 添加性能指标收集

3. **功能完善**
   - 完善继续执行逻辑
   - 添加更多工具支持
   - 优化错误处理

4. **文档更新**
   - 更新开发者文档
   - 添加故障排查指南
   - 提供性能调优建议

## 💡 最佳实践

1. **开发时**: 使用主线程模式，便于调试
2. **生产时**: 启用 Worker 模式，提高响应性
3. **复杂任务**: 始终使用 Worker 模式
4. **简单对话**: 可以使用主线程模式减少开销

## 📞 支持

如遇到问题，请检查：
1. Worker 是否正确初始化 (查看控制台日志)
2. 工具桥接是否正常工作
3. Worker 池状态是否正常
4. 是否有 JavaScript 错误

可以在 WorkerSettingsPanel 中查看 Worker 池的实时状态。