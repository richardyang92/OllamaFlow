import { memo, useState } from 'react'
import { NodeProps, Handle, Position } from '@xyflow/react'
import { LoopNodeData, PortDefinition } from '@/types/node'
import { useWorkflowStore } from '@/store/workflow-store'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { getEdgeColorByNodeType, getEdgeHoverColorByNodeType } from '@/store/workflow-store'

const statusStyles = {
  idle: {
    border: 'border-[var(--color-border-subtle)]',
    shadow: '',
    dot: 'bg-[var(--color-text-muted)]',
  },
  running: {
    border: 'border-yellow-500/40',
    shadow: '',
    dot: 'bg-yellow-500',
  },
  success: {
    border: 'border-green-500/40',
    shadow: '',
    dot: 'bg-green-500',
  },
  error: {
    border: 'border-red-500/40',
    shadow: '',
    dot: 'bg-red-500',
  },
}

const categoryBadgeColors = {
  'Input': 'bg-[var(--color-node-input-bg)] text-[var(--color-node-input)] border border-[var(--color-node-input-border)]',
  'AI': 'bg-[var(--color-node-ai-bg)] text-[var(--color-node-ai)] border border-[var(--color-node-ai-border)]',
  'Logic': 'bg-[var(--color-node-logic-bg)] text-[var(--color-node-logic)] border border-[var(--color-node-logic-border)]',
  'Data': 'bg-[var(--color-node-data-bg)] text-[var(--color-node-data)] border border-[var(--color-node-data-border)]',
  'File': 'bg-[var(--color-node-file-bg)] text-[var(--color-node-file)] border border-[var(--color-node-file-border)]',
  'System': 'bg-[var(--color-node-system-bg)] text-[var(--color-node-system)] border border-[var(--color-node-system-border)]',
  'Output': 'bg-[var(--color-node-output-bg)] text-[var(--color-node-output)] border border-[var(--color-node-output-border)]',
  default: 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]',
}

function LoopNode(props: NodeProps) {
  const { data, id, selected } = props
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const { nodes } = useWorkflowStore()

  const nodeData = data as LoopNodeData
  const status = nodeData.status || 'idle'
  const statusStyle = statusStyles[status as keyof typeof statusStyles]
  const inputCount = nodeData.inputs.length
  const outputCount = nodeData.outputs.length

  const getLoopDescription = () => {
    switch (nodeData.loopMode) {
      case 'count':
        return `循环 ${nodeData.count} 次`
      case 'array':
        return '遍历数组'
      case 'condition':
        return '条件循环'
      default:
        return '循环'
    }
  }

  const getLoopDetail = () => {
    switch (nodeData.loopMode) {
      case 'count':
        return `次数: ${nodeData.count}`
      case 'array':
        return nodeData.arraySource?.length > 25
          ? `${nodeData.arraySource.substring(0, 25)}...`
          : nodeData.arraySource
      case 'condition':
        return nodeData.conditionExpression?.length > 25
          ? `${nodeData.conditionExpression.substring(0, 25)}...`
          : nodeData.conditionExpression
      default:
        return ''
    }
  }

  const childNodes = nodes.filter(n => n.parentId === id)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(true)
  }

  const handleDragLeave = () => {
    setIsDraggingOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)
  }

  return (
    <div className="relative">
      {/* Input Handles */}
      {nodeData.inputs.map((input: PortDefinition, index: number) => (
        <Handle
          key={`input-${input.id}`}
          type="target"
          position={Position.Left}
          id={input.id}
          className={cn(
            '!w-3 !h-3',
            '!bg-[var(--color-text-muted)]',
            '!border-2 !border-[var(--color-border)]',
            'hover:!bg-[var(--color-accent)] hover:shadow-[var(--shadow-handle-hover)]',
            'transition-all duration-200'
          )}
          style={{
            top: inputCount === 1 ? '50%' : `${((index + 1) / (inputCount + 1)) * 100}%`,
            zIndex: 9999
          }}
          title={input.label}
        />
      ))}

      {/* Output Handles */}
      {nodeData.outputs.map((output: PortDefinition, index: number) => {
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
              zIndex: 9999
            }}
            title={output.label}
          />
        )
      })}

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        data-status={status}
        data-node-id={id}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'min-w-[400px] min-h-[300px]',
          'rounded-xl',
          'bg-[var(--color-bg-card)]',
          'backdrop-blur-sm',
          'border',
          statusStyle.border,
          selected as boolean && [
            'border-[var(--color-accent)]',
            'ring-2 ring-[var(--color-accent-border)]',
            'shadow-[0_0_20px_var(--color-accent-bg)]',
            'bg-[var(--color-bg-input)]'
          ],
          statusStyle.shadow,
          'transition-all duration-200 ease-out',
          isDraggingOver && [
            'border-[var(--color-accent)]',
            'ring-2 ring-[var(--color-accent-border)]',
            'bg-[var(--color-accent-bg)]'
          ]
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-3 border-b border-[var(--color-border-subtle)] rounded-t-xl bg-[var(--color-bg-elevated)]">
          <motion.div
            className={cn('w-2.5 h-2.5 rounded-full', statusStyle.dot)}
            animate={status === 'running' ? {
              scale: [1, 1.2, 1],
              opacity: [1, 0.8, 1],
            } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="text-base">🔄</span>
          <span className="font-medium text-sm truncate flex-1 text-[var(--color-text)]">
            {nodeData.label}
          </span>
          <span className={cn(
            "px-2.5 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider whitespace-nowrap",
            categoryBadgeColors[nodeData.category as keyof typeof categoryBadgeColors] || categoryBadgeColors.default
          )}>
            {nodeData.category}
          </span>
        </div>

        {/* Info Bar */}
        <div className="px-5 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-input)]">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="node-primary-badge logic flex items-center gap-2 flex-1">
                <span className="font-mono font-semibold text-xs text-[var(--color-text)]">
                  {getLoopDescription()}
                </span>
              </div>
              {childNodes.length > 0 && (
                <span className="px-2 py-0.5 rounded bg-[var(--color-node-logic-bg)] text-[var(--color-node-logic)] border border-[var(--color-node-logic-border)] text-[10px] font-medium">
                  {childNodes.length} 个子节点
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-subtle)]">
              <span className="px-1.5 py-0.5 rounded bg-[var(--color-bg-input)]">
                变量: {nodeData.loopVariable}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[var(--color-bg-input)]">
                索引: {nodeData.indexVariable}
              </span>
              <span className="font-mono text-[var(--color-text-muted)] truncate flex-1">
                {getLoopDetail()}
              </span>
            </div>
          </div>
        </div>

        {/* Container Area - where child nodes are shown */}
        <div className="flex-1 p-4 min-h-[200px] relative">
          {childNodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center m-4 border-2 border-dashed border-[var(--color-border-subtle)] rounded-lg pointer-events-none">
              <div className="text-center text-[var(--color-text-subtle)]">
                <div className="text-3xl mb-2">📦</div>
                <div className="text-sm">拖拽节点到此处</div>
                <div className="text-xs mt-1">添加到循环体</div>
              </div>
            </div>
          )}
        </div>

        {/* Error message */}
        {nodeData.error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 rounded-b-lg"
          >
            <p className="text-red-500 text-xs">{nodeData.error}</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}

export default memo(LoopNode)
