/**
 * Agent 消息块组件
 * 展示单条消息，包括用户消息和助手消息
 * 支持编辑、重做、删除操作
 */

import { memo, useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Bot, Loader2, RotateCcw, Trash2, Pencil, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentMessage } from '@/store/agent-store'
import { AgentStepBlock } from './AgentStepBlock'
import AgentMarkdown from './AgentMarkdown'
import StreamingFlashText from '@/components/nodes/shared/StreamingFlashText'

interface AgentMessageBlockProps {
  message: AgentMessage
  onRetry?: () => void
  onDelete?: () => void
  onEdit?: (newContent: string) => void
  isLast?: boolean
  isRunning?: boolean
  className?: string
}

// 流式光标动画组件
function StreamingCursor() {
  return (
    <span className="inline-block w-0.5 h-4 ml-0.5 bg-blue-400 animate-pulse" />
  )
}

// 操作按钮组件
function MessageActionButton({
  icon: Icon,
  onClick,
  tooltip,
  destructive = false,
}: {
  icon: typeof RotateCcw
  onClick: () => void
  tooltip: string
  destructive?: boolean
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        'p-1.5 rounded-md transition-all duration-200',
        'opacity-0 group-hover:opacity-100',
        destructive
          ? 'hover:bg-red-500/10 hover:text-red-400 text-[var(--color-text-muted)]'
          : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
      )}
      title={tooltip}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  )
}

// 用户消息
function UserMessage({
  content,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  content: string
  isEditing: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: (newContent: string) => void
  onDelete: () => void
}) {
  const [editContent, setEditContent] = useState(content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(content.length, content.length)
    }
  }, [isEditing, content])

  useEffect(() => {
    setEditContent(content)
  }, [content])

  const handleSave = () => {
    const trimmed = editContent.trim()
    if (trimmed && trimmed !== content) {
      onSaveEdit(trimmed)
    } else {
      onCancelEdit()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      onCancelEdit()
    }
  }

  return (
    <div className="flex gap-3 group">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
        <User className="w-4 h-4 text-purple-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-xs text-[var(--color-text-muted)]">你</div>
          {/* 操作按钮 */}
          <div className="flex items-center gap-0.5 ml-auto">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="p-1.5 rounded-md hover:bg-green-500/10 text-green-400 transition-colors"
                  title="保存"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onCancelEdit}
                  className="p-1.5 rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] transition-colors"
                  title="取消"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <MessageActionButton
                  icon={Pencil}
                  onClick={onStartEdit}
                  tooltip="编辑消息"
                />
                <MessageActionButton
                  icon={Trash2}
                  onClick={onDelete}
                  tooltip="删除消息"
                  destructive
                />
              </>
            )}
          </div>
        </div>
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 text-sm bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-[var(--color-text)]"
            rows={3}
          />
        ) : (
          <div className="text-sm text-[var(--color-text)] whitespace-pre-wrap">
            {content}
          </div>
        )}
      </div>
    </div>
  )
}

// 助手消息
function AssistantMessage({
  message,
  onRetry,
  onDelete,
  isLast,
  isRunning,
}: {
  message: AgentMessage
  onRetry?: () => void
  onDelete?: () => void
  isLast?: boolean
  isRunning?: boolean
}) {
  const hasSteps = message.steps && message.steps.length > 0
  const hasContent = message.content && message.content.trim().length > 0
  const isStreaming = message.isStreaming
  const responseStreaming = message.responseStreaming
  const hasReasoningContent = message.reasoningContent && message.reasoningContent.trim().length > 0
  const reasoningStreaming = message.reasoningStreaming

  // 当执行完成（不在流式中）且有最终回复时，收起执行过程
  const shouldCollapseSteps = !isStreaming && !responseStreaming && Boolean(hasContent)

  // 是否显示操作按钮（非流式状态）
  const showActions = !isStreaming && !responseStreaming && !isRunning

  return (
    <div className="flex gap-3 group">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
        <Bot className="w-4 h-4 text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-2">
          <span>助手</span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-blue-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>思考中...</span>
            </span>
          )}
          {/* 操作按钮 - 只在完成状态显示 */}
          {showActions && (
            <div className="flex items-center gap-0.5 ml-auto">
              {isLast && onRetry && (
                <MessageActionButton
                  icon={RotateCcw}
                  onClick={onRetry}
                  tooltip="重新生成"
                />
              )}
              {onDelete && (
                <MessageActionButton
                  icon={Trash2}
                  onClick={onDelete}
                  tooltip="删除消息"
                  destructive
                />
              )}
            </div>
          )}
        </div>

        {/* 推理内容快闪展示 - DeepSeek R1 等 */}
        {(reasoningStreaming || hasReasoningContent) && isStreaming && (
          <motion.div
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 overflow-hidden"
          >
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="text-sm"
                >
                  🧠
                </motion.span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">推理思考中</span>
                {reasoningStreaming && (
                  <motion.span
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-[10px] text-amber-600/60 dark:text-amber-400/60"
                  >
                    ●
                  </motion.span>
                )}
              </div>
              <StreamingFlashText
                text={message.reasoningContent || ''}
                isStreaming={reasoningStreaming || false}
                maxLength={reasoningStreaming ? 60 : 100}
                prefix=""
                textColor="text-amber-700 dark:text-amber-300"
              />
            </div>
          </motion.div>
        )}

        {/* 推理步骤 - SubAgent 风格时间线 */}
        {hasSteps && (
          <div className="relative mb-3">
            {/* 左侧连接线 */}
            <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-[var(--color-border-subtle)]" />

            {/* 步骤列表 */}
            <div className="space-y-0">
              {message.steps!.map((step, index) => (
                <AgentStepBlock
                  key={step.id}
                  step={step}
                  isLast={index === message.steps!.length - 1}
                  defaultExpanded={step.status === 'thinking' || step.status === 'acting'}
                  forceCollapsed={shouldCollapseSteps}
                />
              ))}
            </div>
          </div>
        )}

        {/* 最终回复 */}
        {(hasContent || responseStreaming) && (
          <div className="mt-3">
            <div className="text-xs text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
              <span>回复</span>
              {responseStreaming && (
                <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
              )}
            </div>
            <div className="text-sm text-[var(--color-text)] bg-[var(--color-bg-elevated)] rounded-lg p-3 border border-[var(--color-border-subtle)]">
              {responseStreaming ? (
                // 流式输出时直接显示文本
                <div className="whitespace-pre-wrap">
                  {message.content}
                  <StreamingCursor />
                </div>
              ) : (
                // 完成后渲染 Markdown
                <AgentMarkdown content={message.content} />
              )}
            </div>
          </div>
        )}

        {/* 等待状态 */}
        {isStreaming && !hasSteps && !hasContent && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span>正在处理...</span>
          </div>
        )}
      </div>
    </div>
  )
}

export const AgentMessageBlock = memo(function AgentMessageBlock({
  message,
  onRetry,
  onDelete,
  onEdit,
  isLast,
  isRunning,
  className,
}: AgentMessageBlockProps) {
  const isUser = message.role === 'user'
  const [isEditing, setIsEditing] = useState(false)

  const handleStartEdit = () => setIsEditing(true)
  const handleCancelEdit = () => setIsEditing(false)
  const handleSaveEdit = (newContent: string) => {
    onEdit?.(newContent)
    setIsEditing(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'py-4',
        isUser ? 'px-0' : 'px-0',
        className
      )}
    >
      {isUser ? (
        <UserMessage
          content={message.content}
          isEditing={isEditing}
          onStartEdit={handleStartEdit}
          onCancelEdit={handleCancelEdit}
          onSaveEdit={handleSaveEdit}
          onDelete={() => onDelete?.()}
        />
      ) : (
        <AssistantMessage
          message={message}
          onRetry={onRetry}
          onDelete={onDelete}
          isLast={isLast}
          isRunning={isRunning}
        />
      )}
    </motion.div>
  )
})

export default AgentMessageBlock
