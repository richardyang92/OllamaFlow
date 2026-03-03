import { memo, useRef, useEffect, useState } from 'react'
import { NodeProps } from '@xyflow/react'
import { Bot, Microscope, ChevronDown, Loader2, CheckCircle, XCircle, Circle } from 'lucide-react'
import BaseNode from './BaseNode'
import { OllamaChatNodeData, NodeStatus } from '@/types/node'
import { useStreamOutput } from '@/hooks/useStreamOutput'
import { useNodeStatus } from '@/hooks/useNodeStatus'
import { motion } from 'framer-motion'

// 推理状态信息接口
interface InferenceStatus {
  isInferring: boolean
  currentStep: string
  tokensProcessed: number
  tokensPerSecond: number
}

function OllamaChatNode(props: NodeProps) {
  const data = props.data as OllamaChatNodeData
  const id = props.id as string
  const streamOutput = useStreamOutput(id)
  const outputRef = useRef<HTMLDivElement>(null)
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false)
  const [nodeStatus, setNodeStatus] = useState<NodeStatus>('idle')
  const [inferenceStatus, setInferenceStatus] = useState<InferenceStatus>({
    isInferring: false,
    currentStep: '空闲',
    tokensProcessed: 0,
    tokensPerSecond: 0
  })

  // Get node result using the hook
  const nodeResult = useNodeStatus(id)

  // Auto scroll to bottom when stream output changes
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [streamOutput])

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
          return {
            isInferring: true,
            currentStep: '生成响应中...',
            tokensProcessed: 0,
            tokensPerSecond: 2.5
          }
        }
        // 正常运行时的状态更新
        return {
          ...prev,
          isInferring: true,
          currentStep: '生成响应中...',
          tokensProcessed: prev.tokensProcessed + 1,
          tokensPerSecond: 2.5
        }
      } else {
        // 非运行状态时重置
        return {
          ...prev,
          isInferring: false,
          currentStep: status === 'success' ? '已完成' : status === 'error' ? '错误' : '空闲',
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

  return (
    <BaseNode {...props} icon={data.debugMode?.enabled ? <Microscope className="w-4 h-4" /> : <Bot className="w-4 h-4" />}>
      <div className="space-y-3 w-full">
        <div className="node-primary-badge ai">
          {data.debugMode?.enabled ? <Microscope className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
          <span className="font-semibold truncate">
            {data.debugMode?.enabled ? data.debugMode.model : data.model}
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
