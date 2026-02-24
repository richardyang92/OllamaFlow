import { useState } from 'react'
import { motion } from 'framer-motion'

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
        <h3 className="text-xl font-medium text-white mb-2">选择项目保存位置</h3>
        <p className="text-sm text-zinc-400">
          选择一个文件夹来保存您的项目文件
        </p>
      </div>

      <div className="space-y-4">
        {/* Path input */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={value || ''}
              readOnly
              placeholder="点击右侧按钮选择文件夹..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all"
            />
            {value && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="text-green-400">✓</span>
              </div>
            )}
          </div>
          <button
            onClick={handleBrowse}
            disabled={isSelecting}
            className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-300 hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSelecting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                选择中...
              </span>
            ) : (
              '浏览...'
            )}
          </button>
        </div>

        {/* Path preview */}
        {value && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-white/5 border border-white/10 rounded-lg"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">📁</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 mb-1">
                  项目将保存到:
                </p>
                <p className="text-xs text-zinc-400 break-all">
                  {value}
                </p>
                <p className="text-xs text-zinc-500 mt-2">
                  将在所选目录下创建 .ollamaflow 配置文件夹
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Help text */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-lg">💡</span>
            <div className="text-xs text-zinc-400 space-y-1">
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
