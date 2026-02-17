import { memo } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { motion } from 'framer-motion'
import { WorkflowNodeData } from '@/types/node'
import { cn } from '@/lib/utils'
import { getEdgeColorByNodeType, getEdgeHoverColorByNodeType } from '@/store/workflow-store'

interface BaseNodeProps extends NodeProps {
  children?: React.ReactNode
  icon?: string
  className?: string
}

const statusStyles = {
  idle: {
    border: 'border-white/8',
    shadow: '',
    dot: 'bg-zinc-500',
  },
  running: {
    border: 'border-yellow-500/40',
    shadow: 'shadow-[0_0_8px_rgba(234,179,8,0.25)]',
    dot: 'bg-yellow-500 animate-pulse-glow',
  },
  success: {
    border: 'border-green-500/40',
    shadow: 'shadow-[0_0_8px_rgba(34,197,94,0.25)]',
    dot: 'bg-green-500',
  },
  error: {
    border: 'border-red-500/40',
    shadow: 'shadow-[0_0_8px_rgba(239,68,68,0.25)]',
    dot: 'bg-red-500',
  },
}

const categoryBadgeColors = {
  '输入': 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  'AI': 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  '逻辑': 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  '数据': 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  '文件': 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  '系统': 'bg-red-500/20 text-red-400 border border-red-500/30',
  '输出': 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
  default: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
}

function BaseNode({ data, selected, children, icon, className }: BaseNodeProps) {
  const nodeData = data as WorkflowNodeData
  const status = nodeData.status || 'idle'
  const statusStyle = statusStyles[status]
  const inputCount = nodeData.inputs.length
  const outputCount = nodeData.outputs.length

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      data-status={status}
      className={cn(
        // 基础玻璃态样式 - 极简风格
        'min-w-[200px] max-w-[280px]',
        'rounded-xl',
        'bg-card-bg',
        'backdrop-blur-sm',
        'border',
        statusStyle.border,
        // 选中状态 - 更明显的视觉效果
        selected && [
          'border-blue-400/50',
          'ring-2 ring-blue-400/30',
          'shadow-[0_0_20px_rgba(96,165,250,0.2)]',
          'bg-white/[0.04]'
        ],
        // 状态发光
        statusStyle.shadow,
        // 过渡动画
        'transition-all duration-200 ease-out',
        className
      )}
    >
      {/* Header - 极简风格 */}
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-white/5 rounded-t-xl bg-white/[0.02]">
        <motion.div
          className={cn('w-2.5 h-2.5 rounded-full', statusStyle.dot)}
          animate={status === 'running' ? {
            scale: [1, 1.2, 1],
            opacity: [1, 0.8, 1],
          } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        {icon && <span className="text-base">{icon}</span>}
        <span className="font-medium text-sm truncate flex-1 text-slate-100">
          {nodeData.label}
        </span>
        {/* Category badge */}
        <span className={cn(
          "px-2.5 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider whitespace-nowrap",
          categoryBadgeColors[nodeData.category as keyof typeof categoryBadgeColors] || categoryBadgeColors.default
        )}>
          {nodeData.category}
        </span>
      </div>

      {/* Content */}
      <div className="px-5 py-4">{children}</div>

      {/* Input Handles - 玻璃态样式 */}
      {nodeData.inputs.map((input, index) => (
        <Handle
          key={`input-${input.id}`}
          type="target"
          position={Position.Left}
          id={input.id}
          className={cn(
            '!w-3 !h-3',
            '!bg-zinc-500',
            '!border-2 !border-zinc-700',
            'hover:!bg-white hover:shadow-[0_0_4px_rgba(255,255,255,0.3)]',
            'transition-all duration-200'
          )}
          style={{
            top: inputCount === 1 ? '50%' : `${((index + 1) / (inputCount + 1)) * 100}%`,
          }}
          title={input.label}
        />
      ))}

      {/* Output Handles - 颜色与连线一致 */}
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
              '!w-3 !h-3',
              '!border-2',
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

      {/* Error message with glass effect */}
      {nodeData.error && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 rounded-b-lg"
        >
          <p className="text-red-400 text-xs">{nodeData.error}</p>
        </motion.div>
      )}
    </motion.div>
  )
}

export default memo(BaseNode)
