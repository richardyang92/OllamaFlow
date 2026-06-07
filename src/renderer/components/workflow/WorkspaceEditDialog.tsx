import { motion } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Pencil } from 'lucide-react'

interface WorkspaceEditDialogProps {
  name: string
  description: string
  onSubmit: (name: string, description: string) => void
  onCancel: () => void
}

export function WorkspaceEditDialog({
  name: initialName,
  description: initialDescription,
  onSubmit,
  onCancel,
}: WorkspaceEditDialogProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync props to state when dialog opens
  useEffect(() => {
    setName(initialName)
    setDescription(initialDescription)
    setError('')
  }, [initialName, initialDescription])

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('SubAgent 名称不能为空')
      return
    }
    onSubmit(name.trim(), description.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
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
        className="relative w-full max-w-md bg-[var(--color-bg-panel)] backdrop-blur-xl rounded-xl border border-[var(--color-border-subtle)] shadow-2xl overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-medium text-[var(--color-text)]">编辑 SubAgent 信息</h2>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            修改 SubAgent 的名称和简介
          </p>
        </div>

        {/* Fields */}
        <div className="px-5 py-4 space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text)]">
              名称
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              placeholder="输入 SubAgent 名称..."
              className={`w-full px-3 py-2 bg-[var(--color-bg-input)] border rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:bg-[var(--color-bg-hover)] transition-all ${
                error
                  ? 'border-red-500/50 focus:border-red-500/50'
                  : 'border-[var(--color-border-subtle)] focus:border-[var(--color-border)]'
              }`}
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text)]">
              简介 <span className="text-[var(--color-text-muted)]">(可选)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入 SubAgent 简介..."
              rows={3}
              className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
          <div className="text-xs text-[var(--color-text-muted)]">
            提示: Enter 保存, Esc 取消
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-input)] rounded-lg transition-all"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all font-medium"
            >
              保存
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
