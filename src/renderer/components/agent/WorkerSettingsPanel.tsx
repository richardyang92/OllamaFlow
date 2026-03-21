import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Settings, Cpu, Activity, Check, AlertCircle } from 'lucide-react'
import { getWorkerPool } from '@/engine/workers/worker-pool'
import { shouldUseWorkerMode, setWorkerMode } from '@/engine/nodes/react-agent-worker'

export function WorkerSettingsPanel() {
  const [workerMode, setWorkerModeState] = useState(false)
  const [poolStatus, setPoolStatus] = useState({
    totalWorkers: 0,
    idleWorkers: 0,
    busyWorkers: 0,
    queuedAgents: 0,
    activeSessions: 0,
  })

  useEffect(() => {
    // 获取当前 Worker 模式状态
    setWorkerModeState(shouldUseWorkerMode())
    
    // 更新池状态
    const updateStatus = () => {
      const pool = getWorkerPool()
      setPoolStatus(pool.getPoolStatus())
    }
    
    updateStatus()
    const interval = setInterval(updateStatus, 1000)
    
    return () => clearInterval(interval)
  }, [])

  const handleToggleWorkerMode = () => {
    const newMode = !workerMode
    setWorkerModeState(newMode)
    setWorkerMode(newMode)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-xl p-6 space-y-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <Settings className="w-5 h-5 text-blue-400" />
        <h2 className="text-lg font-semibold">Agent Worker 设置</h2>
      </div>

      {/* Worker 模式开关 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-purple-400" />
            <div>
              <p className="font-medium">启用 Worker 模式</p>
              <p className="text-sm text-gray-400">在独立线程中执行 Agent，避免阻塞 UI</p>
            </div>
          </div>
          
          <button
            onClick={handleToggleWorkerMode}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              workerMode ? 'bg-blue-500' : 'bg-gray-600'
            }`}
          >
            <motion.div
              animate={{ x: workerMode ? 28 : 2 }}
              className="absolute top-1 w-5 h-5 bg-white rounded-full"
            />
          </button>
        </div>

        {workerMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20"
          >
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-blue-400 mt-0.5" />
              <p className="text-sm text-blue-200">
                Worker 模式已启用。Agent 将在后台线程中执行，不会阻塞界面响应。
              </p>
            </div>
          </motion.div>
        )}

        {!workerMode && (
          <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5" />
              <p className="text-sm text-yellow-200">
                Worker 模式已禁用。Agent 将在主线程中执行，大量计算可能会阻塞界面。
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Worker 池状态 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-green-400" />
          <h3 className="font-medium">Worker 池状态</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatusCard 
            label="总 Workers" 
            value={poolStatus.totalWorkers} 
            color="blue"
          />
          <StatusCard 
            label="空闲 Workers" 
            value={poolStatus.idleWorkers} 
            color="green"
          />
          <StatusCard 
            label="忙碌 Workers" 
            value={poolStatus.busyWorkers} 
            color="yellow"
          />
          <StatusCard 
            label="队列中的 Agents" 
            value={poolStatus.queuedAgents} 
            color="purple"
          />
          <StatusCard 
            label="活跃会话" 
            value={poolStatus.activeSessions} 
            color="orange"
            className="col-span-2"
          />
        </div>
      </div>

      {/* 说明 */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>• Worker 模式使用 Web Worker 在独立线程中执行 Agent</p>
        <p>• 支持多 Agent 并发执行，最大并发数可配置</p>
        <p>• 工具执行仍然通过主线程调用 electronAPI</p>
        <p>• 修改设置后需要重启应用才能完全生效</p>
      </div>
    </motion.div>
  )
}

function StatusCard({ 
  label, 
  value, 
  color,
  className = '' 
}: { 
  label: string
  value: number
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'orange'
  className?: string
}) {
  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  }

  return (
    <div className={`p-3 rounded-lg border ${colorClasses[color]} ${className}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}
