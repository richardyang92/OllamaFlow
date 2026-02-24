import { motion } from 'framer-motion'
import { useState } from 'react'

interface BasicInfoStepProps {
  projectName: string
  description: string
  onNameChange: (name: string) => void
  onDescriptionChange: (description: string) => void
}

export default function BasicInfoStep({
  projectName,
  description,
  onNameChange,
  onDescriptionChange,
}: BasicInfoStepProps) {
  const [error, setError] = useState<string | null>(null)

  const handleNameChange = (value: string) => {
    onNameChange(value)

    // Validation
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

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h3 className="text-xl font-medium text-white mb-2">基本信息</h3>
        <p className="text-sm text-zinc-400">
          为您的项目设置名称和描述
        </p>
      </div>

      <div className="space-y-4">
        {/* Project Name */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
            项目名称 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="输入项目名称..."
            className={`w-full px-4 py-3 bg-white/5 border rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none transition-all ${
              error
                ? 'border-red-500/50 focus:border-red-500/50'
                : 'border-white/10 focus:border-blue-500/50'
            }`}
            maxLength={50}
          />
          {error ? (
            <p className="text-xs text-red-400">{error}</p>
          ) : (
            <p className="text-xs text-zinc-500">
              {projectName.length}/50 字符
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
            项目描述 <span className="text-zinc-500">(可选)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="描述这个项目的用途..."
            rows={3}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
            maxLength={200}
          />
          <p className="text-xs text-zinc-500">
            {description.length}/200 字符
          </p>
        </div>

        {/* Preview */}
        {projectName.trim() && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-white/5 border border-white/10 rounded-lg"
          >
            <p className="text-xs text-zinc-500 mb-2">预览</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
                {projectName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">
                  {projectName}
                </p>
                {description && (
                  <p className="text-xs text-zinc-500 line-clamp-1">
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
