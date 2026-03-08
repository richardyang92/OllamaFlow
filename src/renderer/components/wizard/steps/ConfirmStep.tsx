import { motion } from 'framer-motion'
import { AlertTriangle, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'
import { projectTemplates } from '../templates'

interface ConfirmStepProps {
  projectPath: string
  projectName: string
  description: string
  selectedTemplate: string
  onTemplateChange: (template: string) => void
}

export default function ConfirmStep({
  projectPath,
  projectName,
  description,
  selectedTemplate,
  onTemplateChange,
}: ConfirmStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h3 className="text-xl font-medium text-[var(--color-text)] mb-2">确认创建</h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          检查您的设置并选择初始模板
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg space-y-3">
          <h4 className="text-sm font-medium text-[var(--color-text)] flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> 配置摘要
          </h4>

          <div className="grid grid-cols-1 gap-3 text-sm">
            <div>
              <p className="text-[var(--color-text-muted)] text-xs">项目名称</p>
              <p className="text-[var(--color-text)]">{projectName || '(未设置)'}</p>
            </div>
            <div>
              <p className="text-[var(--color-text-muted)] text-xs">保存位置</p>
              <p className="text-[var(--color-text)] text-xs break-all">{projectPath}</p>
            </div>
          </div>

          {description && (
            <div>
              <p className="text-[var(--color-text-muted)] text-xs">项目描述</p>
              <p className="text-[var(--color-text-muted)] text-sm">{description}</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--color-text)]">
            选择初始模板
          </label>
          <div className="grid grid-cols-3 gap-3">
            {projectTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => onTemplateChange(template.id)}
                className={cn(
                  'p-4 rounded-lg border transition-all text-left',
                  selectedTemplate === template.id
                    ? 'bg-blue-500/20 border-blue-500/50 ring-1 ring-blue-500/30'
                    : 'bg-[var(--color-bg-input)] border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-hover)] hover:border-[var(--color-border)]'
                )}
              >
                <div className="text-2xl mb-2">{template.icon}</div>
                <div className="font-medium text-sm text-[var(--color-text)]">
                  {template.name}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">
                  {template.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--color-text-muted)]">
              如果所选目录已包含工作区配置，将会被覆盖。
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
