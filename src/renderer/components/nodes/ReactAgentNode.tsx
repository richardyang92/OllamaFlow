import { memo, useState } from 'react'
import { NodeProps } from '@xyflow/react'
import { BarChart3 } from 'lucide-react'
import BaseNode from './BaseNode'
import { ReactAgentNodeData, NodeStatus, AVAILABLE_TOOLS } from '@/types/node'
import { useReActState } from '@/hooks/useReActState'
import { useReasoningStream } from '@/hooks/useReasoningStream'
import { useNodeStatus } from '@/hooks/useNodeStatus'
import { useExecutionStore } from '@/store/execution-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useSettingsStore } from '@/store/settings-store'
import { useAgentAnalytics } from '@/hooks/useAgentAnalytics'
import { motion, AnimatePresence } from 'framer-motion'
import ReActStepsPanel from './react-agent/ReActStepsPanel'
import StreamingFlashText from './shared/StreamingFlashText'
import { AgentAnalyticsPanel } from '@/components/agent/AgentAnalyticsPanel'

function ReactAgentNode(props: NodeProps) {
  const data = props.data as ReactAgentNodeData
  const id = props.id as string
  const reactState = useReActState(id)
  const reasoningOutput = useReasoningStream(id)
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false)
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false)
  const nodeResult = useNodeStatus(id)

  // Initialize agent analytics
  useAgentAnalytics({
    nodeId: id,
    reactState,
    query: data.userMessage,
    maxIterations: data.maxIterations || 10,
  })

  // Get pending question from current workspace
  const workspacePath = useWorkspaceStore((state) => state.currentWorkspace?.path)
  const pendingQuestion = useExecutionStore((state) => {
    if (!workspacePath) return null
    return state.getPendingQuestionForWorkspace(workspacePath)
  })

  const isWaitingForInput = pendingQuestion?.nodeId === id && pendingQuestion?.nodeType === 'reactAgent'

  const executionStatus = nodeResult?.status || 'idle'
  const nodeStatus: NodeStatus =
    executionStatus === 'pending' || executionStatus === 'skipped'
      ? 'idle'
      : (executionStatus as NodeStatus)

  const getStatusStyle = () => {
    if (isWaitingForInput) {
      return {
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        icon: '💬',
        label: '等待输入',
      }
    }
    
    switch (nodeStatus) {
      case 'running':
        return {
          color: 'text-blue-400',
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20',
          icon: '🧠',
          label: '推理中',
        }
      case 'success':
        return {
          color: 'text-green-400',
          bg: 'bg-green-500/10',
          border: 'border-green-500/20',
          icon: '✅',
          label: '完成',
        }
      case 'error':
        return {
          color: 'text-red-400',
          bg: 'bg-red-500/10',
          border: 'border-red-500/20',
          icon: '❌',
          label: '错误',
        }
      default:
        return {
          color: 'text-[var(--color-text-muted)]',
          bg: 'bg-[var(--color-bg-input)]',
          border: 'border-[var(--color-border-subtle)]',
          icon: '⏸️',
          label: '空闲',
        }
    }
  }

  const statusStyle = getStatusStyle()

  const enabledToolIds = data.enabledTools || []
  const enabledTools = AVAILABLE_TOOLS.filter(
    (t) => t.builtIn || enabledToolIds.includes(t.id as typeof enabledToolIds[number])
  )
  const totalToolsCount = enabledTools.length

  // Get global config for display
  const { globalAIConfig } = useSettingsStore()
  const displayModel = data.debugMode?.enabled
    ? data.debugMode.model
    : data.model || globalAIConfig?.defaultModel || '(未选择模型)'

  return (
    <BaseNode {...props} icon={data.debugMode?.enabled ? "🔬" : "🧠"}>
      <div className="space-y-3 w-full">
        <div className="node-primary-badge ai">
          <span className="text-lg">{data.debugMode?.enabled ? "🔬" : "🧠"}</span>
          <span className="font-semibold truncate">
            {displayModel}
          </span>
        </div>

        {data.debugMode?.enabled && (
          <div className="text-[10px] px-2 py-1 bg-amber-500/20 text-amber-400 rounded flex items-center gap-1">
            <span>🔬</span> Debug Mode (OpenAI)
          </div>
        )}
        
        {isWaitingForInput && (
          <div className="text-[10px] px-2 py-1 bg-blue-500/20 text-blue-400 rounded flex items-center gap-1">
            <span>💬</span> 等待用户输入
          </div>
        )}

        <div className="node-secondary-info flex justify-between items-center">
          <span className="text-[var(--color-text-muted)]">工具: {totalToolsCount}</span>
          <span className="text-[var(--color-text-muted)]">最大思考轮次: {data.maxIterations}</span>
        </div>

        <motion.div
          className={`${statusStyle.bg} ${statusStyle.border} rounded-lg p-2 flex items-center justify-between cursor-pointer`}
          onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="flex items-center gap-2">
            <motion.span
              className={statusStyle.color}
              animate={nodeStatus === 'running' ? { rotate: 360 } : { rotate: 0 }}
              transition={
                nodeStatus === 'running'
                  ? { duration: 1, repeat: Infinity, ease: 'linear' }
                  : { duration: 0 }
              }
            >
              {statusStyle.icon}
            </motion.span>
            <span className={`text-xs font-medium ${statusStyle.color}`}>
              {statusStyle.label}
            </span>
            {reactState?.isRunning && (
              <span className="text-[10px] text-[var(--color-text-subtle)] ml-1">
                ({reactState.currentIteration}/{reactState.maxIterations})
              </span>
            )}
          </div>
          <motion.span
            className={`text-xs ${statusStyle.color}`}
            animate={{ rotate: isDetailsExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            ▼
          </motion.span>
        </motion.div>

        {/* 快闪推理状态 - 优先显示推理思考内容（DeepSeek R1 等） */}
        {nodeStatus === 'running' && (reasoningOutput || (reactState?.steps && reactState.steps.length > 0)) && (
          <motion.div
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg p-2">
              {reasoningOutput ? (
                // 显示 OpenAI 推理内容（如 DeepSeek R1 的 reasoning_content）
                <>
                  <div className="flex items-center gap-1.5 mb-1">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className="text-xs"
                    >
                      🧠
                    </motion.span>
                    <span className="text-[10px] text-[var(--color-node-ai)] font-medium">深度思考中</span>
                  </div>
                  <StreamingFlashText
                    text={reasoningOutput}
                    isStreaming={true}
                    maxLength={reasoningOutput.length > 100 ? 40 : 20}
                    prefix=""
                    textColor="text-[var(--color-node-ai)]"
                  />
                </>
              ) : reactState?.steps && reactState.steps.length > 0 ? (
                // 显示 ReAct 步骤状态
                (() => {
                  const latestStep = reactState.steps[reactState.steps.length - 1]
                  const statusConfig = {
                    thinking: {
                      icon: '💭',
                      prefix: '思考: ',
                      color: 'text-[var(--color-node-ai)]',
                      anim: { rotate: 360 }
                    },
                    acting: {
                      icon: '🔧',
                      prefix: '执行: ',
                      color: 'text-[var(--color-node-logic)]',
                      anim: { scale: [1, 1.2, 1] }
                    },
                    observing: {
                      icon: '👁',
                      prefix: '观察: ',
                      color: 'text-[var(--color-node-input)]',
                      anim: { opacity: [1, 0.5, 1] }
                    },
                    error: {
                      icon: '❌',
                      prefix: '错误: ',
                      color: 'text-red-400',
                      anim: { opacity: [1, 0.5, 1] }
                    },
                    completed: {
                      icon: '✅',
                      prefix: '完成: ',
                      color: 'text-green-400',
                      anim: { scale: [1, 1.1, 1] }
                    }
                  }
                  const config = statusConfig[latestStep.status as keyof typeof statusConfig] || statusConfig.thinking
                  const content = latestStep.thought || latestStep.action || latestStep.observation || ''

                  return (
                    <div className="flex items-center gap-1.5">
                      <motion.span
                        animate={config.anim}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        className="text-sm"
                      >
                        {config.icon}
                      </motion.span>
                      <StreamingFlashText
                        text={content}
                        isStreaming={latestStep.status === 'thinking' || latestStep.observationStreaming}
                        maxLength={30}
                        prefix={config.prefix}
                        textColor={config.color}
                      />
                    </div>
                  )
                })()
              ) : null}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{
            height: isDetailsExpanded ? 'auto' : 0,
            opacity: isDetailsExpanded ? 1 : 0,
          }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg p-3 space-y-2">
            <div className="text-xs text-[var(--color-text-muted)] mb-2">已启用工具:</div>
            {enabledTools.map((tool) => (
              <div key={tool.id} className="text-xs text-[var(--color-text)] flex items-center gap-2">
                <span className="text-[var(--color-node-ai)]">•</span>
                <span>{tool.label}</span>
                {tool.builtIn && <span className="text-[var(--color-text-subtle)]">(内置)</span>}
              </div>
            ))}
          </div>
        </motion.div>

        {(reactState?.steps?.length || nodeStatus === 'running') && (
          <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
            <div className="text-xs text-[var(--color-text-muted)] mb-2 flex items-center gap-2">
              <span>推理过程:</span>
              {nodeStatus === 'running' && (
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-[var(--color-node-ai)]"
                >
                  ●
                </motion.span>
              )}
            </div>
            {reactState ? (
              <ReActStepsPanel state={reactState} />
            ) : (
              <div className="text-xs text-[var(--color-text-subtle)] italic">等待开始...</div>
            )}
          </div>
        )}

        {/* 查看分析按钮 */}
        {(reactState?.steps?.length ?? 0) > 0 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsAnalyticsOpen(true)}
            className="w-full mt-3 px-3 py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            查看执行分析
          </motion.button>
        )}
      </div>

      {/* 分析面板 */}
      <AnimatePresence>
        {isAnalyticsOpen && (
          <AgentAnalyticsPanel
            nodeId={id}
            isOpen={isAnalyticsOpen}
            onClose={() => setIsAnalyticsOpen(false)}
          />
        )}
      </AnimatePresence>
    </BaseNode>
  )
}

export default memo(ReactAgentNode)
