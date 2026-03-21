import { useState } from 'react'
import { motion } from 'framer-motion'
import { Globe } from 'lucide-react'
import { useSettingsStore } from '@/store/settings-store'
import { cn } from '@/lib/utils'
import GlobalAIConfigPanel from '@/components/settings/GlobalAIConfigPanel'

export function GlobalAIConfigButton() {
  const [showPanel, setShowPanel] = useState(false)
  const { isGlobalAIEnabled, globalAIConfig } = useSettingsStore()

  return (
    <>
      <motion.button
        onClick={() => setShowPanel(true)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium',
          'text-[var(--color-text-muted)]',
          'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]',
          'transition-all duration-200',
          isGlobalAIEnabled && 'text-blue-400 bg-blue-500/10'
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        title={isGlobalAIEnabled ? `全局配置: ${globalAIConfig?.name || '已启用'}` : '配置全局 AI 端点'}
      >
        <Globe className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">
          {isGlobalAIEnabled ? (globalAIConfig?.name || 'AI') : 'AI 配置'}
        </span>
      </motion.button>

      <GlobalAIConfigPanel
        isOpen={showPanel}
        onClose={() => setShowPanel(false)}
      />
    </>
  )
}
