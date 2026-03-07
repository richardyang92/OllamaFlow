/**
 * Agent 任务列表面板
 * 展示任务进度和任务列表
 */

import { memo, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Circle, Loader2, ListTodo } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentTodoState } from '@/store/agent-store'

interface AgentTodosPanelProps {
  todos: AgentTodoState
  className?: string
}

// 单个任务项
function TodoItem({ item }: { item: { id: string; content: string; completed: boolean } }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors',
        item.completed && 'opacity-60'
      )}
    >
      {item.completed ? (
        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
      ) : (
        <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />
      )}
      <span className={cn(
        'text-sm text-[var(--color-text)] flex-1 min-w-0 truncate',
        item.completed && 'line-through'
      )}>
        {item.content}
      </span>
    </motion.div>
  )
}

export const AgentTodosPanel = memo(function AgentTodosPanel({
  todos,
  className,
}: AgentTodosPanelProps) {
  const { items } = todos

  // 计算进度
  const progress = useMemo(() => {
    if (items.length === 0) return { percentage: 0, completed: 0, total: 0 }
    const completed = items.filter(item => item.completed).length
    return {
      percentage: Math.round((completed / items.length) * 100),
      completed,
      total: items.length,
    }
  }, [items])

  // 分组：进行中和已完成
  const pendingItems = useMemo(() => items.filter(item => !item.completed), [items])
  const completedItems = useMemo(() => items.filter(item => item.completed), [items])

  if (items.length === 0) {
    return (
      <div className={cn('p-4', className)}>
        <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm">
          <ListTodo className="w-4 h-4" />
          <span>暂无任务</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* 标题和进度 */}
      <div className="px-4 py-3 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-[var(--color-text-muted)]" />
            <span className="text-sm font-medium text-[var(--color-text)]">任务进度</span>
          </div>
          <span className="text-xs text-[var(--color-text-muted)]">
            {progress.completed}/{progress.total}
          </span>
        </div>

        {/* 进度条 */}
        <div className="h-1.5 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress.percentage}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* 进行中的任务 */}
        {pendingItems.length > 0 && (
          <div className="mb-3">
            <div className="px-4 py-1 text-xs text-[var(--color-text-muted)] font-medium flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>进行中 ({pendingItems.length})</span>
            </div>
            <AnimatePresence mode="popLayout">
              {pendingItems.map(item => (
                <TodoItem key={item.id} item={item} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* 已完成的任务 */}
        {completedItems.length > 0 && (
          <div>
            <div className="px-4 py-1 text-xs text-[var(--color-text-muted)] font-medium flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-400" />
              <span>已完成 ({completedItems.length})</span>
            </div>
            <AnimatePresence mode="popLayout">
              {completedItems.map(item => (
                <TodoItem key={item.id} item={item} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
})

export default AgentTodosPanel
