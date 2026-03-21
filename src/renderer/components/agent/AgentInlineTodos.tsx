import { Check, Circle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'
import type { TodoItem } from '@/types/node'
import { cn } from '@/lib/utils'

interface AgentInlineTodosProps {
  todos: TodoItem[]
  isRunning: boolean
}

export default function AgentInlineTodos({ todos, isRunning }: AgentInlineTodosProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [contentHeight, setContentHeight] = useState<number>(0)
  const contentRef = useRef<HTMLDivElement>(null)

  const completedCount = todos.filter((t) => t.completed).length
  const totalCount = todos.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  useEffect(() => {
    if (contentRef.current && isExpanded) {
      setContentHeight(contentRef.current.scrollHeight)
    } else if (!isExpanded) {
      setContentHeight(0)
    }
  }, [todos, isExpanded])

  if (todos.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 mb-2"
    >
      {/* 标题栏 - 可点击收起 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between mb-2 hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--color-text-muted)]">任务进度</span>
          <span className="text-[var(--color-text)] font-medium">
            {completedCount}/{totalCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <Loader2 className="w-3.5 h-3.5 text-[var(--color-accent)] animate-spin" />
          )}
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          )}
        </div>
      </button>

      {/* 进度条 - 始终显示 */}
      <div className="h-1.5 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
          className="h-full bg-[var(--color-accent)] rounded-full"
        />
      </div>

      {/* 任务列表 - 可收起 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: contentHeight, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div ref={contentRef} className="space-y-1.5 max-h-32 overflow-y-auto mt-3">
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
                      <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
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
        )}
      </AnimatePresence>
    </motion.div>
  )
}
