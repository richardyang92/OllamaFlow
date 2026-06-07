import type { ExecutionStatus } from '@/types/execution'
import { motion } from 'framer-motion'
import { Undo2, Redo2, Download, Upload } from 'lucide-react'
import { useTemporalStore } from '@/store/workflow-store'

interface ToolbarProps {
  workspaceName: string
  isDirty: boolean
  executionStatus: ExecutionStatus
  onSave: () => void
  onClose: () => void
  onExecute: () => void
  onToggleLogs: () => void
  onExport?: () => void
  onImport?: () => void
}

export default function Toolbar({
  workspaceName,
  isDirty,
  executionStatus,
  onSave,
  onClose,
  onExecute,
  onToggleLogs,
  onExport,
  onImport,
}: ToolbarProps) {
  // 检测 macOS 以适配交通灯按钮位置
  const isMac = navigator.userAgent.toLowerCase().includes('mac')

  // Undo/Redo state
  const { undo, redo, pastStates, futureStates } = useTemporalStore((state) => ({
    undo: state.undo,
    redo: state.redo,
    pastStates: state.pastStates,
    futureStates: state.futureStates,
  }))

  const canUndo = pastStates.length > 0
  const canRedo = futureStates.length > 0

  return (
    <div
      className="h-14 flex items-center justify-between bg-panel-bg backdrop-blur-md"
      style={{ paddingLeft: isMac ? '78px' : '20px', paddingRight: '20px' }}
    >
      {/* Left side - Workspace info */}
      <div className="flex items-center gap-4">
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onClose}
          className="btn-sci-fi btn-ghost btn-sm px-3"
          title="关闭项目"
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

      {/* Right side - Undo/Redo, Import/Export, Logs, Save and Execute buttons */}
      <div className="flex items-center gap-2">
        {/* Undo/Redo buttons */}
        <div className="flex items-center gap-1 mr-2">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={undo}
            disabled={!canUndo}
            className="btn-sci-fi btn-ghost btn-sm px-2 py-1.5"
            title="撤销 (Cmd+Z)"
          >
            <Undo2 className={`w-4 h-4 ${canUndo ? 'text-zinc-300' : 'text-zinc-600'}`} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={redo}
            disabled={!canRedo}
            className="btn-sci-fi btn-ghost btn-sm px-2 py-1.5"
            title="重做 (Cmd+Shift+Z)"
          >
            <Redo2 className={`w-4 h-4 ${canRedo ? 'text-zinc-300' : 'text-zinc-600'}`} />
          </motion.button>
        </div>

        <div className="h-6 w-px bg-white/10" />

        {/* Import/Export buttons */}
        {onImport && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onImport}
            className="btn-sci-fi btn-ghost btn-sm px-2 py-1.5"
            title="导入 SubAgent"
          >
            <Upload className="w-4 h-4 text-zinc-300" />
          </motion.button>
        )}
        {onExport && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onExport}
            className="btn-sci-fi btn-ghost btn-sm px-2 py-1.5"
            title="导出 SubAgent"
          >
            <Download className="w-4 h-4 text-zinc-300" />
          </motion.button>
        )}

        <div className="h-6 w-px bg-white/10" />

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
