import type { ExecutionStatus } from '@/types/execution'
import { motion } from 'framer-motion'

interface ToolbarProps {
  workspaceName: string
  isDirty: boolean
  executionStatus: ExecutionStatus
  onSave: () => void
  onClose: () => void
  onExecute: () => void
  onToggleLogs: () => void
}

export default function Toolbar({
  workspaceName,
  isDirty,
  executionStatus,
  onSave,
  onClose,
  onExecute,
  onToggleLogs,
}: ToolbarProps) {
  return (
    <div className="h-14 flex items-center justify-between px-5 bg-panel-bg backdrop-blur-md">
      {/* Left side - Workspace info */}
      <div className="flex items-center gap-4">
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onClose}
          className="btn-sci-fi btn-ghost btn-sm px-3"
          title="关闭工作区"
        >
          ← 返回
        </motion.button>
        <div className="h-6 w-px bg-white/10" />
        <div className="flex items-center gap-2">
          <span className="text-lg">📁</span>
          <span className="font-medium text-zinc-100 text-sm">{workspaceName}</span>
          {isDirty && (
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-yellow-400 text-sm"
            >
              ●
            </motion.span>
          )}
        </div>
      </div>

      {/* Right side - Logs, Save and Execute buttons */}
      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onToggleLogs}
          className="btn-sci-fi btn-ghost btn-sm px-3"
        >
          📋 日志
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onSave}
          disabled={!isDirty}
          className="btn-sci-fi btn-ghost btn-sm px-3"
        >
          💾 保存
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onExecute}
          className="btn-sci-fi btn-ghost btn-sm px-3"
        >
          {executionStatus === 'running' ? '⏹ 停止' : '▶ 执行'}
        </motion.button>
      </div>
    </div>
  )
}
