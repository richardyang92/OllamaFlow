import { Eye, Code } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ViewMode = 'preview' | 'source'

interface ViewToggleProps {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}

export default function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-[var(--color-bg-input)] rounded-lg">
      <button
        onClick={() => onChange('preview')}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
          mode === 'preview'
            ? 'bg-[var(--color-bg-hover)] text-[var(--color-text)]'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
        )}
      >
        <Eye className="w-3.5 h-3.5" />
        预览
      </button>
      <button
        onClick={() => onChange('source')}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
          mode === 'source'
            ? 'bg-[var(--color-bg-hover)] text-[var(--color-text)]'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
        )}
      >
        <Code className="w-3.5 h-3.5" />
        源码
      </button>
    </div>
  )
}
