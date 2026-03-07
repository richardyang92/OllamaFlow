import { useState } from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, Loader2 } from 'lucide-react'

interface Props {
  prompt: string
  context?: string
  onSubmit: (userInput: string) => void
  onCancel: () => void
  isSubmitting?: boolean
}

export default function ReactAgentInputDialog({
  prompt,
  context,
  onSubmit,
  onCancel,
  isSubmitting = false
}: Props) {
  const [userInput, setUserInput] = useState('')
  const [error, setError] = useState('')
  
  const handleSubmit = () => {
    if (!userInput.trim()) {
      setError('请输入内容')
      return
    }
    onSubmit(userInput)
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-2xl bg-[var(--color-bg-panel)] backdrop-blur-xl rounded-xl border border-[var(--color-border-subtle)] shadow-2xl overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-[var(--color-text)]">智能体需要您的输入</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                ReAct 智能体正在等待您的回复
              </p>
            </div>
          </div>
          
          {context && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)]">
              <div className="text-xs text-[var(--color-text-muted)] mb-1">上下文：</div>
              <div className="text-sm text-[var(--color-text)] line-clamp-3">
                {context}
              </div>
            </div>
          )}
        </div>
        
        {/* Input */}
        <div className="px-6 py-4 space-y-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text)]">
              {prompt}
            </label>
            <textarea
              value={userInput}
              onChange={(e) => {
                setUserInput(e.target.value)
                if (error) setError('')
              }}
              placeholder="请输入您的回复..."
              rows={4}
              className={`w-full px-3 py-2 bg-[var(--color-bg-input)] border rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:bg-[var(--color-bg-hover)] transition-all resize-none ${
                error
                  ? 'border-red-500/50 focus:border-red-500'
                  : 'border-[var(--color-border-subtle)] focus:border-[var(--color-border)]'
              }`}
              autoFocus
            />
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between bg-[var(--color-bg-elevated)]">
          <div className="text-xs text-[var(--color-text-muted)]">
            提示: Ctrl+Enter 提交, Esc 取消
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-input)] rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? '处理中...' : '发送'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
