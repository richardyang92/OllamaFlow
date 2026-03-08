import { memo, useRef, useEffect, useState } from 'react'
import { NodeProps } from '@xyflow/react'
import { Bot, Microscope, ChevronDown, Loader2, CheckCircle, XCircle, Circle } from 'lucide-react'
import BaseNode from './BaseNode'
import { OllamaChatNodeData, NodeStatus } from '@/types/node'
import { useStreamOutput } from '@/hooks/useStreamOutput'
import { useReasoningStream } from '@/hooks/useReasoningStream'
import { useNodeStatus } from '@/hooks/useNodeStatus'
import { useSettingsStore } from '@/store/settings-store'
import { motion } from 'framer-motion'
import StreamingFlashText from './shared/StreamingFlashText'

// 推理状态信息接口
interface InferenceStatus {
  isInferring: boolean
  currentStep: string
  tokensProcessed: number
  tokensPerSecond: number
}

// 简单估算 token 数量（中文约 1.5 字符/token，英文约 4 字符/token）
function estimateTokens(text: string): number {
  if (!text) return 0
  // 统计中文字符数
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  // 非中文字符数
  const otherChars = text.length - chineseChars
  // 估算 token 数
  return Math.ceil(chineseChars / 1.5 + otherChars / 4)
}

function OllamaChatNode(props: NodeProps) {
  const data = props.data as OllamaChatNodeData
  const id = props.id as string
  const streamOutput = useStreamOutput(id)
  const reasoningOutput = useReasoningStream(id)

  // Debug: log reasoning output changes
  useEffect(() => {
    if (reasoningOutput) {
      console.log('[OllamaChatNode] reasoningOutput updated:', { id, length: reasoningOutput.length, preview: reasoningOutput.substring(0, 50) + '...' })
    }
  }, [reasoningOutput, id])

  const outputRef = useRef<HTMLDivElement>(null)
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false)
  const [nodeStatus, setNodeStatus] = useState<NodeStatus>('idle')
  const [inferenceStatus, setInferenceStatus] = useState<InferenceStatus>({
    isInferring: false,
    currentStep: '空闲',
    tokensProcessed: 0,
    tokensPerSecond: 0
  })

  // 用于计算 token 速度的状态
  const tokenHistoryRef = useRef<{ time: number; count: number }[]>([])

  // Get node result using the hook
  const nodeResult = useNodeStatus(id)

  // Auto scroll to bottom when stream output changes
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [streamOutput])

  // 根据流式输出更新 token 统计
  useEffect(() => {
    if (nodeStatus !== 'running' || !streamOutput) return

    const currentTokens = estimateTokens(streamOutput)
    const now = Date.now()

    // 记录当前 token 数和时间
    tokenHistoryRef.current.push({ time: now, count: currentTokens })

    // 只保留最近 5 秒的数据
    const fiveSecondsAgo = now - 5000
    tokenHistoryRef.current = tokenHistoryRef.current.filter(
      entry => entry.time > fiveSecondsAgo
    )

    // 计算速度（需要至少两个数据点）
    let tokensPerSecond = 0
    if (tokenHistoryRef.current.length >= 2) {
      const oldest = tokenHistoryRef.current[0]
      const timeDiff = (now - oldest.time) / 1000 // 秒
      if (timeDiff > 0) {
        tokensPerSecond = (currentTokens - oldest.count) / timeDiff
      }
    }

    setInferenceStatus(prev => ({
      ...prev,
      tokensProcessed: currentTokens,
      tokensPerSecond: Math.max(0, tokensPerSecond)
    }))
  }, [streamOutput, nodeStatus])

  // Update status when nodeResult changes
  useEffect(() => {
    const executionStatus = nodeResult?.status || 'idle'

    // 类型转换：将 NodeExecutionStatus 映射到 NodeStatus
    const status: NodeStatus = executionStatus === 'pending' || executionStatus === 'skipped' ? 'idle' : executionStatus as NodeStatus

    // 只有当状态发生变化时才更新和记录日志
    if (status !== nodeStatus) {
      console.log(`[OllamaChatNode] Status updated for node ${id}: ${nodeStatus} → ${status} (execution status: ${executionStatus})`)
      setNodeStatus(status)
    }

    const isInferring = status === 'running'

    setInferenceStatus(prev => {
      if (isInferring) {
        // 第一次进入运行状态时初始化
        if (!prev.isInferring) {
          tokenHistoryRef.current = [] // 重置历史记录
          return {
            isInferring: true,
            currentStep: '生成响应中...',
            tokensProcessed: 0,
            tokensPerSecond: 0
          }
        }
        // 保持当前状态（token 更新由 streamOutput effect 处理）
        return {
          ...prev,
          isInferring: true,
          currentStep: '生成响应中...'
        }
      } else {
        // 非运行状态时更新
        tokenHistoryRef.current = []

        // 成功完成时保留最终的 token 统计数据
        if (status === 'success') {
          return {
            ...prev,
            isInferring: false,
            currentStep: '已完成',
            // 保留 tokensProcessed 和 tokensPerSecond，不清零
          }
        }

        // 错误或空闲状态时重置统计数据
        return {
          ...prev,
          isInferring: false,
          currentStep: status === 'error' ? '错误' : '空闲',
          tokensProcessed: 0,
          tokensPerSecond: 0
        }
      }
    })
  }, [id, nodeResult, nodeStatus])

  // 切换详细信息展开/收起
  const toggleDetails = () => {
    setIsDetailsExpanded(!isDetailsExpanded)
  }

  // 获取状态样式
  const getStatusStyle = () => {
    const status = nodeStatus
    switch (status) {
      case 'running':
        return {
          color: 'text-blue-500',
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20',
          icon: <Loader2 className="w-3.5 h-3.5" />,
          label: '推理中'
        }
      case 'success':
        return {
          color: 'text-green-500',
          bg: 'bg-green-500/10',
          border: 'border-green-500/20',
          icon: <CheckCircle className="w-3.5 h-3.5" />,
          label: '完成'
        }
      case 'error':
        return {
          color: 'text-red-500',
          bg: 'bg-red-500/10',
          border: 'border-red-500/20',
          icon: <XCircle className="w-3.5 h-3.5" />,
          label: '错误'
        }
      default:
        return {
          color: 'text-[var(--color-text-muted)]',
          bg: 'bg-[var(--color-bg-input)]',
          border: 'border-[var(--color-border-subtle)]',
          icon: <Circle className="w-3.5 h-3.5" />,
          label: '空闲'
        }
    }
  }

  const statusStyle = getStatusStyle()

  // Get global config for display
  const { globalAIConfig } = useSettingsStore()
  const displayModel = data.debugMode?.enabled
    ? data.debugMode.model
    : data.model || globalAIConfig?.defaultModel || '(未选择模型)'

  return (
    <BaseNode {...props} icon={data.debugMode?.enabled ? <Microscope className="w-4 h-4" /> : <Bot className="w-4 h-4" />}>
      <div className="space-y-3 w-full">
        <div className="node-primary-badge ai">
          {data.debugMode?.enabled ? <Microscope className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
          <span className="font-semibold truncate">
            {displayModel}
          </span>
        </div>

        {data.debugMode?.enabled && (
          <div className="text-[10px] px-2 py-1 bg-amber-500/20 text-amber-400 rounded flex items-center gap-1">
            <Microscope className="w-3 h-3" /> Debug Mode (OpenAI)
          </div>
        )}

        {/* Secondary Info - Temperature and Stream */}
        <div className="node-secondary-info flex justify-between items-center">
          <span className="text-[var(--color-text-muted)]">温度: {data.temperature}</span>
          {data.stream && <span className="text-[var(--color-node-logic)] text-[10px] font-medium">● 流式</span>}
        </div>

        {/* Inference Status Indicator */}
        <motion.div
          className={`${statusStyle.bg} ${statusStyle.border} rounded-lg p-2 flex items-center justify-between cursor-pointer`}
          onClick={toggleDetails}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="flex items-center gap-2">
            <motion.span
              className={statusStyle.color}
              animate={nodeStatus === 'running' ? { rotate: 360 } : { rotate: 0 }}
              transition={nodeStatus === 'running' ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
            >
              {statusStyle.icon}
            </motion.span>
            <span className={`text-xs font-medium ${statusStyle.color}`}>
              {statusStyle.label}
            </span>
          </div>
          <motion.span
            className={`text-xs ${statusStyle.color}`}
            animate={{ rotate: isDetailsExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </motion.span>
        </motion.div>

        {/* 快闪推理内容预览 - 优先显示推理思考内容 */}
        {nodeStatus === 'running' && (reasoningOutput || streamOutput) && (
          <motion.div
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg p-2">
              {reasoningOutput ? (
                <>
                  <div className="flex items-center gap-1.5 mb-1">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      className="text-xs"
                    >
                      🧠
                    </motion.span>
                    <span className="text-[10px] text-[var(--color-node-ai)] font-medium">思考中</span>
                  </div>
                  <StreamingFlashText
                    text={reasoningOutput}
                    isStreaming={true}
                    maxLength={reasoningOutput.length > 100 ? 40 : 20}
                    prefix=""
                    textColor="text-[var(--color-node-ai)]"
                  />
                </>
              ) : (
                <StreamingFlashText
                  text={streamOutput}
                  isStreaming={true}
                  maxLength={streamOutput.length > 100 ? 40 : 20}
                  prefix="生成中: "
                />
              )}
            </div>
          </motion.div>
        )}

        {/* Inference Details */}
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ 
            height: isDetailsExpanded ? 'auto' : 0,
            opacity: isDetailsExpanded ? 1 : 0
          }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div className="bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg p-3 space-y-2">
              {/* Status Details */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-subtle)]">当前步骤</span>
                <span className="text-[var(--color-text)] truncate">{inferenceStatus.currentStep}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-subtle)]">处理 token</span>
                <span className="text-[var(--color-text)]">{inferenceStatus.tokensProcessed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-subtle)]">每秒 token</span>
                <span className="text-[var(--color-text)]">{inferenceStatus.tokensPerSecond.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Show streaming output if available */}
        {streamOutput && (
          <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
            <div className="text-xs text-[var(--color-text-muted)] mb-1.5">输出:</div>
            <div 
              ref={outputRef}
              className="text-xs text-[var(--color-text)] max-h-24 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed"
            >
              {streamOutput}
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export default memo(OllamaChatNode)
