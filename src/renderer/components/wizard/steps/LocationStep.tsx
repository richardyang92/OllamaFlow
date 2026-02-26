import { useState } from 'react'
import { motion } from 'framer-motion'
import { Folder, Check, Loader2, Lightbulb } from 'lucide-react'

interface LocationStepProps {
  value: string | null
  onChange: (path: string) => void
}

export default function LocationStep({ value, onChange }: LocationStepProps) {
  const [isSelecting, setIsSelecting] = useState(false)

  const handleBrowse = async () => {
    setIsSelecting(true)
    try {
      const path = await window.electronAPI.workspace.open()
      if (path) {
        onChange(path)
      }
    } catch (error) {
      console.error('选择目录失败:', error)
    } finally {
      setIsSelecting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h3 className="text-xl font-medium text-[var(--color-text)] mb-2">选择项目保存位置</h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          选择一个文件夹来保存您的项目文件
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={value || ''}
              readOnly
              placeholder="点击右侧按钮选择文件夹..."
              className="w-full px-4 py-3 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-blue-500/50 transition-all"
            />
            {value && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Check className="w-4 h-4 text-green-400" />
              </div>
            )}
          </div>
          <button
            onClick={handleBrowse}
            disabled={isSelecting}
            className="px-4 py-3 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-border)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSelecting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                选择中...
              </span>
            ) : (
              '浏览...'
            )}
          </button>
        </div>

        {value && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg"
          >
            <div className="flex items-start gap-3">
              <Folder className="w-6 h-6 text-[var(--color-text-muted)]" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)] mb-1">
                  项目将保存到:
                </p>
                <p className="text-xs text-[var(--color-text-muted)] break-all">
                  {value}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-2 opacity-70">
                  将在所选目录下创建 .ollamaflow 配置文件夹
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-blue-400 shrink-0" />
            <div className="text-xs text-[var(--color-text-muted)] space-y-1">
              <p>• 可以选择一个空文件夹或已有文件夹</p>
              <p>• 如果文件夹中已有工作区配置，将会覆盖</p>
              <p>• 建议为每个项目创建独立的文件夹</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
