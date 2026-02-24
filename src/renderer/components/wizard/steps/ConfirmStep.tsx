import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { projectTemplates } from '../templates'

type AIBackend = 'ollama' | 'openai'

interface ConfirmStepProps {
  projectPath: string
  projectName: string
  description: string
  aiBackend: AIBackend
  apiEndpoint: string
  defaultModel: string
  selectedTemplate: string
  onTemplateChange: (template: string) => void
}

export default function ConfirmStep({
  projectPath,
  projectName,
  description,
  aiBackend,
  apiEndpoint,
  defaultModel,
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
        <h3 className="text-xl font-medium text-white mb-2">确认创建</h3>
        <p className="text-sm text-zinc-400">
          检查您的设置并选择初始模板
        </p>
      </div>

      <div className="space-y-4">
        {/* Settings Summary */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-lg space-y-3">
          <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
            <span>📋</span> 配置摘要
          </h4>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-zinc-500 text-xs">项目名称</p>
              <p className="text-zinc-200">{projectName || '(未设置)'}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs">AI 后端</p>
              <p className="text-zinc-200">
                {aiBackend === 'ollama' ? '🦙 Ollama' : '🌐 OpenAI 兼容'}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-zinc-500 text-xs">保存位置</p>
              <p className="text-zinc-200 text-xs break-all">{projectPath}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs">API 端点</p>
              <p className="text-zinc-200 text-xs">{apiEndpoint}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs">默认模型</p>
              <p className="text-zinc-200">{defaultModel || '(未设置)'}</p>
            </div>
          </div>

          {description && (
            <div>
              <p className="text-zinc-500 text-xs">项目描述</p>
              <p className="text-zinc-400 text-sm">{description}</p>
            </div>
          )}
        </div>

        {/* Template Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
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
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                )}
              >
                <div className="text-2xl mb-2">{template.icon}</div>
                <div className="font-medium text-sm text-zinc-200">
                  {template.name}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {template.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Warning for existing workspace */}
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-yellow-400">⚠️</span>
            <p className="text-xs text-zinc-400">
              如果所选目录已包含工作区配置，将会被覆盖。
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
