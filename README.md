# OllamaFlow

> 一个为 Ollama AI 模型设计的可视化工作流构建器

OllamaFlow 是一个基于 Electron 的桌面应用程序，允许用户通过拖拽节点的方式构建与 Ollama AI 模型交互的自动化工作流。无需编写代码，即可创建包含 AI 对话、文件操作、命令执行和条件逻辑的复杂工作流程。

## 功能特性

- **可视化节点编辑器** - 基于 React Flow 的直观拖拽式工作流设计
- **Ollama 集成** - 直接与本地 Ollama 实例交互，支持所有可用模型
- **多种节点类型**：
  - 🤖 **Ollama 对话** - AI 文本生成和对话
  - 🧠 **ReAct 智能体** - 基于 Function Calling 的自主推理与工具调用
  - 📁 **文件操作** - 读取/写入文件
  - 🖼️ **图像处理** - 图像生成和处理
  - 🔁 **循环控制** - 批处理和迭代操作
  - ⚙️ **Shell 命令** - 执行系统命令
  - 🔀 **条件判断** - 基于条件的分支逻辑
  - 📝 **用户输入** - 工作流启动时收集用户输入
- **ReAct 智能体工具**：
  - ✅ **待办事项** - 任务规划与管理（内置）
  - 💻 **执行命令** - 运行 Shell 脚本和程序
  - 📖 **读取文件** - 从工作区读取文件内容
  - ✏️ **写入文件** - 将内容保存到文件
  - 🌐 **HTTP 请求** - 发送网络请求获取数据
- **实时执行监控** - 查看节点状态和执行日志
- **流式输出** - 实时显示 Ollama 响应
- **变量插值** - 使用 `{{variableName}}` 语法在节点间传递数据
- **工作空间管理** - 保存和加载多个工作流

## 截图

### 欢迎界面

![OllamaFlow Welcome](screenshot/OllamaFlow%20Welcome.png)

### 工作流编辑器

![OllamaFlow Editor](screenshot/OllamaFlow%20Editor.png)

### ReAct 智能体

ReAct 智能体节点支持自主推理和工具调用，能够自动分解复杂任务、规划执行步骤，并使用多种工具完成任务。

![OllamaFlow Agent](screenshot/OllamaFlow%20Agent.png)

智能体执行时会实时显示：
- **思考过程** - 当前推理内容
- **工具调用** - 正在使用的工具及参数
- **观察结果** - 工具执行返回的结果
- **迭代进度** - 当前迭代/最大迭代次数

## 系统要求

- **Node.js** >= 18.0.0
- **Ollama** - 需要本地安装并运行 Ollama
  - 下载地址：https://ollama.ai/download
  - 默认主机：`http://localhost:11434`

## 安装

```bash
# 克隆仓库
git clone https://github.com/richardyang92/OllamaFlow.git
cd OllamaFlow

# 安装依赖
npm install
```

## 开发

```bash
# 启动开发服务器（支持热重载）
npm run dev

# 代码检查
npm run lint
```

## 构建

```bash
# 构建生产版本
npm run build

# 构建 Windows 安装包
npm run build:win

# 构建但不打包（用于测试）
npm run build:unpack
```

构建产物位于 `dist/` 目录。

## 使用指南

### 创建工作流

1. 点击工具栏中的"新建工作区"创建新的工作空间
2. 从左侧节点面板拖拽节点到画布
3. 连接节点以定义数据流向
4. 点击节点在右侧面板配置其属性
5. 点击"运行"按钮执行工作流

### 变量插值

在工作流中使用 `{{variableName}}` 语法引用变量：

- 引用其他节点的输出：`{{nodeName.fieldName}}`
- 支持嵌套访问：`{{node.data.subfield.value}}`
- 使用用户输入：`{{userInput.inputName}}`

### ReAct 智能体

ReAct 智能体是一个基于 **Reasoning + Acting** 模式的自主代理节点，能够：

1. **自主推理** - 分析任务需求，制定执行计划
2. **工具调用** - 通过 Function Calling 使用各种工具
3. **迭代执行** - 循环"思考-行动-观察"直到任务完成

#### 配置选项

| 选项 | 说明 |
|------|------|
| 模型 | 使用的 Ollama 模型（推荐支持 Function Calling 的模型） |
| 系统提示 | 智能体的角色和行为指南 |
| 用户消息 | 要执行的任务描述 |
| 最大迭代 | 推理循环的最大次数（防止无限循环） |
| 启用工具 | 选择智能体可以使用的工具 |

#### 可用工具

- **todos（待办事项）** - 规划和管理任务列表
- **executeCommand（执行命令）** - 运行 Shell 命令
- **readFile（读取文件）** - 读取工作区文件
- **writeFile（写入文件）** - 创建或修改文件
- **httpRequest（HTTP 请求）** - 发送网络请求

#### 使用示例

创建一个能自动完成编程任务的智能体：

1. 拖入 **ReAct 智能体** 节点
2. 配置模型（如 `llama3.2` 或 `qwen2.5`）
3. 设置任务：`"创建一个 Python 脚本计算斐波那契数列并运行它"`
4. 启用 `writeFile` 和 `executeCommand` 工具
5. 运行工作流，观察智能体自动：
   - 规划任务步骤
   - 编写 Python 代码
   - 保存到文件
   - 执行脚本
   - 返回结果

### 工作空间结构

工作空间以文件夹形式存储，包含：

```
workspace-folder/
├── .ollamaflow/
│   ├── config.json       # 工作空间配置
│   ├── workflow.json     # 节点和边数据
│   └── cache/            # 运行时缓存
```

## 项目架构

```
OllamaFlow/
├── src/
│   ├── main/           # Electron 主进程
│   │   └── index.ts    # IPC 处理、文件系统操作
│   ├── preload/        # 预加载脚本
│   │   └── index.ts    # Context Bridge 暴露 API
│   └── renderer/       # React UI 应用
│       ├── components/ # UI 组件
│       │   ├── nodes/      # 节点可视化组件
│       │   └── workflow/   # 工作流编辑器
│       ├── engine/     # 执行引擎
│       │   └── nodes/      # 节点执行器
│       ├── store/      # Zustand 状态管理
│       └── types/      # TypeScript 类型定义
├── scripts/
│   └── dev.js          # 开发服务器脚本
└── electron.vite.config.ts  # Vite 配置
```

### 添加新节点类型

1. 在 [src/renderer/types/node.ts](src/renderer/types/node.ts) 中定义节点类型
2. 在 [src/renderer/components/nodes/](src/renderer/components/nodes/) 创建可视化组件
3. 在 [src/renderer/components/workflow/properties/](src/renderer/components/workflow/properties/) 创建属性面板
4. 在 [src/renderer/engine/nodes/](src/renderer/engine/nodes/) 实现执行器
5. 注册到节点模板和执行器注册表

详细说明请参阅 [CLAUDE.md](CLAUDE.md)。

## 技术栈

- **框架** - Electron + React + TypeScript
- **构建工具** - Vite + electron-vite
- **UI 库** - React Flow、TailwindCSS、Framer Motion
- **状态管理** - Zustand
- **AI 集成** - Ollama (JavaScript SDK)
- **存储** - electron-store

## 许可证

Apache 2.0 License - 详见 LICENSE 文件

## 贡献

欢迎贡献！请随时提交 Issue 或 Pull Request。

## 致谢

- [Ollama](https://ollama.ai) - 本地 LLM 运行时
- [React Flow](https://reactflow.dev) - 强大的节点编辑器
- [Electron](https://www.electronjs.org) - 跨平台桌面应用框架
