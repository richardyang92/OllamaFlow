import { Check, Circle, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { TodoItem } from '@/types/node'
import { cn } from '@/lib/utils'

interface AgentInlineTodosProps {
  todos: TodoItem[]
  isRunning: boolean
}

export default function AgentInlineTodos({ todos, isRunning }: AgentInlineTodosProps) {
  if (todos.length === 0) return null

  const completedCount = todos.filter((t) => t.completed).length
  const totalCount = todos.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="glass-panel rounded-xl p-3 mb-2"
    >
      {/* 进度条 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--color-text-muted)]">任务进度</span>
          <span className="text-purple-400 font-medium">
            {completedCount}/{totalCount}
          </span>
        </div>
        {isRunning && (
          <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
        )}
      </div>

      {/* 进度条 */}
      <div className="h-1.5 bg-[var(--color-bg-input)] rounded-full overflow-hidden mb-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
        />
      </div>

      {/* 任务列表 */}
      <div className="space-y-1.5 max-h-32 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {todos.map((todo, index) => (
            <motion.div
              key={todo.id || index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className={cn(
                'flex items-center gap-2 text-xs py-1 px-2 rounded',
                todo.completed && 'text-[var(--color-text-muted)]',
                !todo.completed && 'text-[var(--color-text)]'
              )}
            >
              {todo.completed ? (
                <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 opacity-40 flex-shrink-0" />
              )}
              <span className={cn(
                'truncate',
                todo.completed && 'line-through'
              )}>
                {todo.content}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
