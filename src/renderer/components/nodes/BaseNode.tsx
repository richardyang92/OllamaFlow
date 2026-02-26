import { memo, type ReactNode } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { motion } from 'framer-motion'
import { WorkflowNodeData } from '@/types/node'
import { cn } from '@/lib/utils'
import { getEdgeColorByNodeType, getEdgeHoverColorByNodeType } from '@/store/workflow-store'

interface BaseNodeProps extends NodeProps {
  children?: React.ReactNode
  icon?: ReactNode
  className?: string
}

const statusStyles = {
  idle: {
    border: 'border-[var(--color-border-subtle)]',
    shadow: '',
    dot: 'bg-[var(--color-text-muted)]',
  },
  running: {
    border: 'border-yellow-500/50',
    shadow: 'shadow-[0_0_12px_rgba(234,179,8,0.3)]',
    dot: 'bg-yellow-400 animate-pulse-glow',
  },
  success: {
    border: 'border-green-500/50',
    shadow: 'shadow-[0_0_12px_rgba(34,197,94,0.3)]',
    dot: 'bg-green-400',
  },
  error: {
    border: 'border-red-500/50',
    shadow: 'shadow-[0_0_12px_rgba(239,68,68,0.3)]',
    dot: 'bg-red-400',
  },
}

const categoryBadgeColors: Record<string, string> = {
  '输入': 'bg-[var(--color-node-input-bg)] text-[var(--color-node-input)] border border-[var(--color-node-input-border)]',
  'AI': 'bg-[var(--color-node-ai-bg)] text-[var(--color-node-ai)] border border-[var(--color-node-ai-border)]',
  '逻辑': 'bg-[var(--color-node-logic-bg)] text-[var(--color-node-logic)] border border-[var(--color-node-logic-border)]',
  '数据': 'bg-[var(--color-node-data-bg)] text-[var(--color-node-data)] border border-[var(--color-node-data-border)]',
  '文件': 'bg-[var(--color-node-file-bg)] text-[var(--color-node-file)] border border-[var(--color-node-file-border)]',
  '系统': 'bg-[var(--color-node-system-bg)] text-[var(--color-node-system)] border border-[var(--color-node-system-border)]',
  '输出': 'bg-[var(--color-node-output-bg)] text-[var(--color-node-output)] border border-[var(--color-node-output-border)]',
}

function BaseNode({ data, selected, children, icon, className }: BaseNodeProps) {
  const nodeData = data as WorkflowNodeData
  const status = nodeData.status || 'idle'
  const statusStyle = statusStyles[status]
  const inputCount = nodeData.inputs.length
  const outputCount = nodeData.outputs.length

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      data-status={status}
      className={cn(
        'min-w-[200px] max-w-[280px]',
        'rounded-glass-lg',
        'glass-node',
        'border',
        statusStyle.border,
        selected && [
          'border-[var(--color-accent)]',
          'ring-2 ring-[var(--color-accent-border)]',
          'shadow-[0_0_20px_var(--color-accent-bg)]',
        ],
        statusStyle.shadow,
        'transition-all duration-200 ease-out',
        className
      )}
    >
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-[var(--color-border-subtle)] rounded-t-glass-lg bg-[var(--color-bg-elevated)]">
        <motion.div
          className={cn('w-2 h-2 rounded-full', statusStyle.dot)}
          animate={status === 'running' ? {
            scale: [1, 1.3, 1],
            opacity: [1, 0.7, 1],
          } : {}}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
        {icon && <span className="flex items-center text-[var(--color-text)]">{icon}</span>}
        <span className="font-medium text-sm truncate flex-1 text-[var(--color-text)]">
          {nodeData.label}
        </span>
        <span className={cn(
          "px-2 py-0.5 text-[10px] font-medium rounded-full tracking-wide whitespace-nowrap",
          categoryBadgeColors[nodeData.category] || 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]'
        )}>
          {nodeData.category}
        </span>
      </div>

      <div className="px-4 py-3">{children}</div>

      {nodeData.inputs.map((input, index) => (
        <Handle
          key={`input-${input.id}`}
          type="target"
          position={Position.Left}
          id={input.id}
          className={cn(
            '!w-2.5 !h-2.5',
            '!bg-[var(--color-bg-input)]',
            '!border-2 !border-[var(--color-border)]',
            'hover:!bg-[var(--color-accent)] hover:!border-[var(--color-accent)]',
            'hover:shadow-[0_0_6px_var(--color-accent-glow)]',
            'transition-all duration-200'
          )}
          style={{
            top: inputCount === 1 ? '50%' : `${((index + 1) / (inputCount + 1)) * 100}%`,
          }}
          title={input.label}
        />
      ))}

      {nodeData.outputs.map((output, index) => {
        const handleColor = getEdgeColorByNodeType(nodeData.nodeType)
        const handleHoverColor = getEdgeHoverColorByNodeType(nodeData.nodeType)
        return (
          <Handle
            key={`output-${output.id}`}
            type="source"
            position={Position.Right}
            id={output.id}
            className={cn(
              '!w-2.5 !h-2.5',
              '!border-2',
              'hover:shadow-[var(--shadow-handle-hover)]',
              'transition-all duration-200'
            )}
            style={{
              backgroundColor: handleColor.replace('0.6', '1').replace('0.9', '1'),
              borderColor: handleHoverColor.replace('0.9', '0.5'),
              top: outputCount === 1 ? '50%' : `${((index + 1) / (outputCount + 1)) * 100}%`,
            }}
            title={output.label}
          />
        )
      })}

      {nodeData.error && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 rounded-b-glass-lg"
        >
          <p className="text-red-500 text-xs">{nodeData.error}</p>
        </motion.div>
      )}
    </motion.div>
  )
}

export default memo(BaseNode)
