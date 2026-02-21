import { memo, useEffect, useState } from 'react'
import { NodeProps } from '@xyflow/react'
import BaseNode from './BaseNode'
import { ReactAgentNodeData, NodeStatus, AVAILABLE_TOOLS } from '@/types/node'
import { useReActState } from '@/hooks/useReActState'
import { useExecutionStore } from '@/store/execution-store'
import { motion } from 'framer-motion'
import ReActStepsPanel from './react-agent/ReActStepsPanel'

function ReactAgentNode(props: NodeProps) {
  const data = props.data as ReactAgentNodeData
  const id = props.id as string
  const reactState = useReActState(id)
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false)
  const [nodeStatus, setNodeStatus] = useState<NodeStatus>('idle')

  // Update status from execution store
  useEffect(() => {
    const updateStatus = () => {
      const nodeResult = useExecutionStore.getState().getNodeStatus(id)
      const executionStatus = nodeResult?.status || 'idle'

      // Map execution status to NodeStatus
      const status: NodeStatus =
        executionStatus === 'pending' || executionStatus === 'skipped'
          ? 'idle'
          : (executionStatus as NodeStatus)

      if (status !== nodeStatus) {
        setNodeStatus(status)
      }
    }

    updateStatus()
    const interval = setInterval(updateStatus, 100)
    return () => clearInterval(interval)
  }, [id, nodeStatus])

  // Get status style
  const getStatusStyle = () => {
    switch (nodeStatus) {
      case 'running':
        return {
          color: 'text-purple-400',
          bg: 'bg-purple-500/10',
          border: 'border-purple-500/20',
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
          color: 'text-gray-400',
          bg: 'bg-gray-500/10',
          border: 'border-gray-500/20',
          icon: '⏸️',
          label: '空闲',
        }
    }
  }

  const statusStyle = getStatusStyle()

  // Get enabled tool info
  const enabledToolIds = data.enabledTools || []
  const enabledTools = AVAILABLE_TOOLS.filter(
    (t) => t.builtIn || enabledToolIds.includes(t.id as typeof enabledToolIds[number])
  )
  const totalToolsCount = enabledTools.length

  return (
    <BaseNode {...props} icon="🧠">
      <div className="space-y-3 w-full">
        {/* Primary Badge - Model Name */}
        <div className="node-primary-badge ai">
          <span className="text-lg">🧠</span>
          <span className="font-semibold truncate">{data.model}</span>
        </div>

        {/* Secondary Info - Tools and Max Iterations */}
        <div className="node-secondary-info flex justify-between items-center">
          <span className="text-gray-400">工具: {totalToolsCount}</span>
          <span className="text-gray-400">最大迭代: {data.maxIterations}</span>
        </div>

        {/* Status Indicator */}
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
            {/* Show current iteration */}
            {reactState?.isRunning && (
              <span className="text-[10px] text-gray-500 ml-1">
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

        {/* Details Panel */}
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{
            height: isDetailsExpanded ? 'auto' : 0,
            opacity: isDetailsExpanded ? 1 : 0,
          }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-3 space-y-2">
            <div className="text-xs text-gray-400 mb-2">已启用工具:</div>
            {enabledTools.map((tool) => (
              <div key={tool.id} className="text-xs text-gray-300 flex items-center gap-2">
                <span className="text-purple-400">•</span>
                <span>{tool.label}</span>
                {tool.builtIn && <span className="text-gray-500">(内置)</span>}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Structured Reasoning Steps */}
        {(reactState?.steps?.length || nodeStatus === 'running') && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
              <span>推理过程:</span>
              {nodeStatus === 'running' && (
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-purple-400"
                >
                  ●
                </motion.span>
              )}
            </div>
            {reactState ? (
              <ReActStepsPanel state={reactState} />
            ) : (
              <div className="text-xs text-gray-500 italic">等待开始...</div>
            )}
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export default memo(ReactAgentNode)
