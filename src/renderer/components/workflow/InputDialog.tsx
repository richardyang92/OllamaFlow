import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import type { WorkflowNode, InputNodeData } from '@/types/node'

interface InputField {
  nodeId: string
  label: string
  prompt: string
  inputType: 'string' | 'number' | 'boolean'
  defaultValue: string
  value: string
}

interface Props {
  nodes: WorkflowNode[]
  onSubmit: (values: Record<string, string>) => void
  onCancel: () => void
}

export default function InputDialog({ nodes, onSubmit, onCancel }: Props) {
  // Get all input nodes
  const inputNodes = nodes.filter(n => n.data.nodeType === 'input')

  // Initialize input fields from input nodes
  const [fields, setFields] = useState<InputField[]>(
    inputNodes.map(node => {
      const data = node.data as InputNodeData
      return {
        nodeId: node.id,
        label: data.label,
        prompt: data.prompt,
        inputType: data.inputType,
        defaultValue: data.defaultValue,
        value: data.defaultValue || '',
      }
    })
  )

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Update a field's value
  const updateField = (nodeId: string, value: string) => {
    setFields(prev => prev.map(f =>
      f.nodeId === nodeId ? { ...f, value } : f
    ))
    // Clear error for this field
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[nodeId]
      return newErrors
    })
  }

  // Validate all fields
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    for (const field of fields) {
      if (!field.value.trim()) {
        newErrors[field.nodeId] = '此字段不能为空'
      } else if (field.inputType === 'number' && isNaN(Number(field.value))) {
        newErrors[field.nodeId] = '请输入有效的数字'
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validate()) {
      const values: Record<string, string> = {}
      fields.forEach(f => {
        values[f.nodeId] = f.value
      })
      onSubmit(values)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  // Focus first empty field on mount
  useEffect(() => {
    const firstEmptyField = fields.find(f => !f.value.trim())
    if (firstEmptyField) {
      const input = document.querySelector(`input[data-node-id="${firstEmptyField.nodeId}"]`) as HTMLInputElement
      input?.focus()
    }
  }, [])

  if (inputNodes.length === 0) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xl">📥</span>
            <h2 className="text-lg font-medium text-white">工作流输入</h2>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            请提供以下输入以执行工作流
          </p>
        </div>

        {/* Fields */}
        <div className="px-5 py-4 space-y-4 max-h-96 overflow-y-auto">
          {fields.map(field => (
            <div key={field.nodeId} className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <span className="text-zinc-500">[{field.label}]</span>
                <span>{field.prompt}</span>
              </label>

              {field.inputType === 'boolean' ? (
                <select
                  data-node-id={field.nodeId}
                  value={field.value}
                  onChange={(e) => updateField(field.nodeId, e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all"
                >
                  <option value="">请选择...</option>
                  <option value="true">真 (True)</option>
                  <option value="false">假 (False)</option>
                </select>
              ) : (
                <input
                  data-node-id={field.nodeId}
                  type={field.inputType === 'number' ? 'number' : 'text'}
                  value={field.value}
                  onChange={(e) => updateField(field.nodeId, e.target.value)}
                  placeholder={`请输入${field.inputType === 'number' ? '数字' : '文本'}...`}
                  className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:bg-white/8 transition-all ${
                    errors[field.nodeId]
                      ? 'border-red-500/50 focus:border-red-500/50'
                      : 'border-white/10 focus:border-blue-500/50'
                  }`}
                />
              )}

              {errors[field.nodeId] && (
                <p className="text-xs text-red-400">{errors[field.nodeId]}</p>
              )}

              {field.defaultValue && (
                <p className="text-xs text-zinc-500">
                  默认值: {field.defaultValue}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            提示: Ctrl+Enter 提交, Esc 取消
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all font-medium"
            >
              执行工作流
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
