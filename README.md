# OllamaFlow

> 一个为 Ollama AI 模型设计的可视化工作流构建器

OllamaFlow 是一个基于 Electron 的桌面应用程序，允许用户通过拖拽节点的方式构建与 Ollama AI 模型交互的自动化工作流。无需编写代码，即可创建包含 AI 对话、文件操作、命令执行和条件逻辑的复杂工作流程。

## 功能特性

- **可视化节点编辑器** - 基于 React Flow 的直观拖拽式工作流设计
- **多 AI 后端支持**：
  - 🦙 **Ollama** - 直接与本地 Ollama 实例交互，支持所有可用模型
  - 🌐 **OpenAI 兼容 API** - 支持 OpenAI、DeepSeek、Azure OpenAI 等兼容 API
- **项目模板向导** - 通过引导式向导快速创建工作流，提供多种预设模板
- **多种节点类型**：
  - 📥 **用户输入** - 工作流启动时收集用户输入
  - 🤖 **Ollama 对话** - AI 文本生成和对话
  - 🧠 **ReAct 智能体** - 基于 Function Calling 的自主推理与工具调用
  - 🛤️ **智能路由** - AI 驱动的动态分支选择
  - 📁 **文件操作** - 读取/写入文件
  - 🖼️ **图片显示** - 显示本地或网络图片，支持从变量获取
  - 🔁 **循环控制** - 批处理和迭代操作
  - ⚙️ **执行命令** - 执行系统命令
  - 🔀 **条件判断** - 基于条件的分支逻辑
  - ✏️ **设置变量** - 定义和使用变量
  - 📤 **输出** - 显示、复制或下载输出内容
  - 📋 **队列** - 接收多路输入入队，有元素时立即出队透传
  - 🔀 **分发** - 将一路输入同时分发给多个输出
- **界面增强**：
  - 🎨 **主题支持** - 亮色/暗色主题自动切换
  - 🗺️ **小地图** - 画布缩略图导航，快速定位节点
- **ReAct 智能体工具**：
  - ✅ **待办事项** - 任务规划与管理（内置）
  - 📅 **获取日期** - 获取当前日期和时间（内置）
  - 💻 **执行命令** - 运行 Shell 脚本和程序
  - 📖 **读取文件** - 从工作区读取文件内容
  - ✏️ **写入文件** - 将内容保存到文件
  - 🌐 **HTTP 请求** - 发送网络请求获取数据
  - 🌐 **浏览器自动化** - Playwright 驱动的网页交互：
    - 导航到 URL
    - 点击元素
    - 输入文本
    - 滚动页面
    - 截取屏幕截图
    - 获取页面内容
    - 执行 JavaScript
    - 等待元素出现
- **实时执行监控** - 查看节点状态和执行日志
- **流式输出** - 实时显示 Ollama 响应
- **变量插值** - 使用 `{{variableName}}` 语法在节点间传递数据
- **工作空间管理** - 保存和加载多个工作流

## 截图

### 欢迎界面

![OllamaFlow Welcome](screenshot/OllamaFlow-Welcome.png#gh-light-mode-only)
![OllamaFlow Welcome Dark](screenshot/OllamaFlow-Welcome-Dark.png#gh-dark-mode-only)

### 工作流编辑器

![OllamaFlow Editor](screenshot/OllamaFlow-Editor.png#gh-light-mode-only)
![OllamaFlow Editor Dark](screenshot/OllamaFlow-Editor-Dark.png#gh-dark-mode-only)

### ReAct 智能体

![OllamaFlow Agent](screenshot/OllamaFlow-Agent.png#gh-light-mode-only)
![OllamaFlow Agent Dark](screenshot/OllamaFlow-Agent-Dark.png#gh-dark-mode-only)

ReAct 智能体节点支持自主推理和工具调用，能够自动分解复杂任务、规划执行步骤，并使用多种工具完成任务。

智能体执行时会实时显示：
- **思考过程** - 当前推理内容
- **工具调用** - 正在使用的工具及参数
- **观察结果** - 工具执行返回的结果
- **迭代进度** - 当前迭代/最大迭代次数

## 系统要求

- **Node.js** >= 18.0.0
- **AI 后端**（任选其一）：
  - **Ollama** - 本地运行，无需联网
    - 下载地址：https://ollama.ai/download
    - 默认主机：`http://localhost:11434`
  - **OpenAI 兼容 API** - 支持云端或自托管服务
    - OpenAI、DeepSeek、Azure OpenAI、vLLM 等
    - 需要提供 API 端点和 API Key

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

### 创建新项目

使用新建项目向导快速创建工作流：

1. **选择位置** - 选择项目存储路径
2. **基本信息** - 设置项目名称和描述
3. **AI 配置** - 选择 AI 后端（Ollama 或 OpenAI 兼容 API）并配置模型
4. **确认创建** - 选择项目模板并完成创建

**可用的项目模板**：

| 模板 | 图标 | 描述 |
|------|------|------|
| 空白项目 | 📄 | 从零开始创建工作流 |
| 基础对话 | 💬 | 包含用户输入、AI 对话和输出节点的简单工作流 |
| 智能助手 | 🧠 | 包含 ReAct 智能体的工作流，支持工具调用 |

### 创建工作流

1. 从欢迎界面点击"新建项目"进入向导
2. 或在工具栏中点击"新建工作区"创建新的工作空间
3. 从左侧节点面板拖拽节点到画布
4. 连接节点以定义数据流向
5. 点击节点在右侧面板配置其属性
6. 点击"运行"按钮执行工作流

### 变量插值

在工作流中使用 `{{variableName}}` 语法引用变量：

- 引用其他节点的输出：`{{nodeName.fieldName}}`
- 支持嵌套访问：`{{node.data.subfield.value}}`
- 使用用户输入：`{{userInput.inputName}}`

### ReAct 智能体

ReAct 智能体是一个基于 **Reasoning + Acting** 模式的自主代理节点，能够：

1. **自主推理** - 分析任务需求，制定执行计划
2. **工具调用** - 通过 Function Calling 使用各种工具
3. **多后端支持** - 兼容 Ollama 和 OpenAI 格式的 API
4. **迭代执行** - 循环"思考-行动-观察"直到任务完成

#### 配置选项

| 选项 | 说明 |
|------|------|
| AI 后端 | 选择 Ollama 或 OpenAI 兼容 API |
| 模型 | 使用的 AI 模型（推荐支持 Function Calling 的模型） |
| API 端点 | API 服务地址（OpenAI 模式需要） |
| API Key | 认证密钥（OpenAI 模式需要） |
| 系统提示 | 智能体的角色和行为指南 |
| 用户消息 | 要执行的任务描述 |
| 最大迭代 | 推理循环的最大次数（防止无限循环） |
| 启用工具 | 选择智能体可以使用的工具 |

#### 可用工具

**内置工具**（始终可用）：
- **todos（待办事项）** - 规划和管理任务列表
- **getCurrentDate（获取日期）** - 获取当前日期和时间

**可选工具**：
- **executeCommand（执行命令）** - 运行 Shell 命令
- **readFile（读取文件）** - 读取工作区文件
- **writeFile（写入文件）** - 创建或修改文件
- **httpRequest（HTTP 请求）** - 发送网络请求

**浏览器自动化工具**：
- **browser_navigate（导航）** - 打开指定网页
- **browser_click（点击）** - 点击页面元素
- **browser_type（输入）** - 在输入框中输入文本
- **browser_scroll（滚动）** - 滚动页面
- **browser_screenshot（截图）** - 截取页面截图
- **browser_getContent（获取内容）** - 获取页面文本或HTML
- **browser_evaluate（执行JS）** - 执行 JavaScript 代码
- **browser_wait（等待）** - 等待元素出现

#### 使用示例

创建一个能自动完成编程任务的智能体：

1. 拖入 **ReAct 智能体** 节点
2. 配置模型（如 `glm-4.7-flash`、`llama3.2` 或 `qwen2.5`）
3. 设置任务：`"创建一个 Python 脚本计算斐波那契数列并运行它"`
4. 启用 `writeFile` 和 `executeCommand` 工具
5. 运行工作流，观察智能体自动：
   - 规划任务步骤
   - 编写 Python 代码
   - 保存到文件
   - 执行脚本
   - 返回结果

#### 浏览器自动化示例

创建一个能自动浏览网页的智能体：

1. 拖入 **ReAct 智能体** 节点
2. 设置任务：`"打开 GitHub 首页，搜索 electron 相关项目，获取前5个项目的名称"`
3. 启用浏览器工具：`browser_navigate`、`browser_type`、`browser_click`、`browser_screenshot`、`browser_getContent`
4. 运行工作流，智能体将自动：
   - 导航到 GitHub
   - 输入搜索关键词
   - 点击搜索按钮
   - 获取搜索结果
   - 返回提取的信息

### 智能路由

智能路由节点使用 AI 分析输入内容，自动选择最合适的分支进行路由。适用于需要根据内容类型动态分配处理逻辑的场景。

#### 工作原理

1. **接收输入** - 接收上游节点传递的数据
2. **AI 分析** - 使用配置的 AI 模型分析输入内容
3. **分支匹配** - 根据分支描述选择最匹配的分支
4. **条件执行** - 只有被选中分支下游的节点会执行

#### 配置选项

| 选项 | 说明 |
|------|------|
| 分支列表 | 定义多个路由分支，每个分支包含名称和描述 |
| 默认分支 | 当 AI 无法确定时使用的备用分支 |
| 模型 | 用于路由决策的 AI 模型 |
| 路由提示词 | 指导 AI 进行分支选择的提示（支持变量插值） |
| 温度 | 控制决策的确定性（值越低越确定） |
| Debug Mode | 使用 OpenAI 兼容 API 替代 Ollama |

#### 使用示例

创建一个智能客服路由：

1. 拖入 **智能路由** 节点
2. 配置分支：
   - **技术问题** - "处理技术相关的询问、bug 报告、功能需求"
   - **商务咨询** - "处理商务合作、价格咨询、合同洽谈"
   - **其他** - "无法分类的其他问题"（设为默认）
3. 连接用户输入到路由节点
4. 为每个分支连接对应的处理节点
5. 运行工作流，AI 将自动将用户问题路由到合适的处理流程

#### 条件执行特性

智能路由节点的一个重要特性是**条件执行**：
- 只有被选中分支的下游节点会被执行
- 未被选中分支的下游节点会被跳过
- 这可以节省计算资源并提高工作流效率

### 文件预览

在工作区文件面板中，点击文件可以预览其内容：
- **文本文件** - 代码、配置文件、日志等
- **图片文件** - PNG、JPG、GIF、WebP 等格式
- **PDF 文件** - 在内置查看器中显示

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
│   │   ├── index.ts    # IPC 处理、文件系统操作
│   │   └── browser/    # Playwright 浏览器自动化
│   ├── preload/        # 预加载脚本
│   │   └── index.ts    # Context Bridge 暴露 API
│   └── renderer/       # React UI 应用
│       ├── components/ # UI 组件
│       │   ├── nodes/      # 节点可视化组件
│       │   ├── workflow/   # 工作流编辑器
│       │   └── wizard/     # 新建项目向导
│       ├── engine/     # 执行引擎
│       │   ├── nodes/      # 节点执行器
│       │   ├── react-agent/ # ReAct 智能体 LLM 抽象层
│       │   └── tools/      # ReAct 智能体工具
│       ├── pages/      # 页面组件
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
- **AI 集成** - Ollama (JavaScript SDK)、OpenAI 兼容 API
- **浏览器自动化** - Playwright Core
- **存储** - electron-store

## 许可证

Apache 2.0 License - 详见 LICENSE 文件

## 贡献

欢迎贡献！请随时提交 Issue 或 Pull Request。

## 致谢

- [Ollama](https://ollama.ai) - 本地 LLM 运行时
- [React Flow](https://reactflow.dev) - 强大的节点编辑器
- [Electron](https://www.electronjs.org) - 跨平台桌面应用框架
- [Playwright](https://playwright.dev) - 浏览器自动化框架
