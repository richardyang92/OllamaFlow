import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DEFAULT_ENDPOINTS } from '@/config/model-config'

async function checkOllamaStatus(apiEndpoint: string): Promise<'online' | 'offline'> {
  try {
    const response = await fetch(`${apiEndpoint}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    })
    return response.ok ? 'online' : 'offline'
  } catch {
    return 'offline'
  }
}

export function OllamaStatus() {
  const [status, setStatus] = useState<'online' | 'offline' | 'checking'>('checking')

  const checkStatus = useCallback(() => {
    setStatus('checking')
    checkOllamaStatus(DEFAULT_ENDPOINTS.ollama).then(setStatus)
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  return (
    <motion.button
      onClick={checkStatus}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium',
        'text-[var(--color-text-muted)]',
        'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]',
        'transition-all duration-200'
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      title="点击刷新 Ollama 状态"
    >
      {status === 'checking' ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-text-muted)]" />
      ) : status === 'online' ? (
        <Wifi className="w-3.5 h-3.5 text-green-400" />
      ) : (
        <WifiOff className="w-3.5 h-3.5 text-red-400" />
      )}
      <span className="hidden sm:inline">
        {status === 'online' ? '在线' : status === 'offline' ? '离线' : '检测中'}
      </span>
    </motion.button>
  )
}
