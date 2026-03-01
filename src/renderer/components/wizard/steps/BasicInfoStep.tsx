import { motion } from 'framer-motion'
import { useState } from 'react'
import { Folder } from 'lucide-react'

interface BasicInfoStepProps {
  projectName: string
  description: string
  defaultProjectsPath: string
  onNameChange: (name: string) => void
  onDescriptionChange: (description: string) => void
}

export default function BasicInfoStep({
  projectName,
  description,
  defaultProjectsPath,
  onNameChange,
  onDescriptionChange,
}: BasicInfoStepProps) {
  const [error, setError] = useState<string | null>(null)

  const handleNameChange = (value: string) => {
    onNameChange(value)

    if (!value.trim()) {
      setError('项目名称不能为空')
    } else if (value.length > 50) {
      setError('项目名称不能超过 50 个字符')
    } else if (/[<>:"/\\|?*]/.test(value)) {
      setError('项目名称包含非法字符')
    } else {
      setError(null)
    }
  }

  // Generate the full project path
  const projectPath = projectName.trim()
    ? `${defaultProjectsPath}/${projectName.trim()}`
    : defaultProjectsPath

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h3 className="text-xl font-medium text-[var(--color-text)] mb-2">基本信息</h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          为您的项目设置名称和描述
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--color-text)]">
            项目名称 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="输入项目名称..."
            className={`w-full px-4 py-3 bg-[var(--color-bg-input)] border rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none transition-all ${
              error
                ? 'border-red-500/50 focus:border-red-500/50'
                : 'border-[var(--color-border-subtle)] focus:border-blue-500/50'
            }`}
            maxLength={50}
          />
          {error ? (
            <p className="text-xs text-red-400">{error}</p>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">
              {projectName.length}/50 字符
            </p>
          )}
        </div>

        {/* Path preview */}
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg"
        >
          <div className="flex items-start gap-2">
            <Folder className="w-4 h-4 text-[var(--color-text-muted)] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">将创建于</p>
              <p className="text-xs text-[var(--color-text-muted)] break-all opacity-80">
                {projectPath}
              </p>
            </div>
          </div>
        </motion.div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--color-text)]">
            项目描述 <span className="text-[var(--color-text-muted)]">(可选)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="描述这个项目的用途..."
            rows={3}
            className="w-full px-4 py-3 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-blue-500/50 transition-all resize-none"
            maxLength={200}
          />
          <p className="text-xs text-[var(--color-text-muted)]">
            {description.length}/200 字符
          </p>
        </div>

        {projectName.trim() && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg"
          >
            <p className="text-xs text-[var(--color-text-muted)] mb-2">预览</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
                {projectName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">
                  {projectName}
                </p>
                {description && (
                  <p className="text-xs text-[var(--color-text-muted)] line-clamp-1">
                    {description}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
