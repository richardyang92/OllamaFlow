import { useState } from 'react'
import { motion } from 'framer-motion'
import { HelpCircle, Loader2 } from 'lucide-react'
import type { PlanQuestion } from '@/types/node'

interface Props {
  questions: PlanQuestion[]
  onSubmit: (answers: Record<string, string>) => void
  onCancel: () => void
  taskDescription?: string
  isSubmitting?: boolean
}

export default function PlanQuestionsDialog({
  questions,
  onSubmit,
  onCancel,
  taskDescription,
  isSubmitting = false
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    questions.forEach(q => {
      if (q.defaultValue) {
        initial[q.id] = q.defaultValue
      } else if (q.type === 'multiselect') {
        initial[q.id] = ''
      } else if (q.type === 'boolean') {
        initial[q.id] = ''
      }
    })
    return initial
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  const updateAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
    if (errors[questionId]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[questionId]
        return newErrors
      })
    }
  }
  
  const handleMultiSelect = (questionId: string, option: string, checked: boolean) => {
    setAnswers(prev => {
      const current = prev[questionId] ? prev[questionId].split(',') : []
      if (checked) {
        current.push(option)
      } else {
        const index = current.indexOf(option)
        if (index > -1) {
          current.splice(index, 1)
        }
      }
      return { ...prev, [questionId]: current.join(',') }
    })
  }
  
  const validate = (): Record<string, string> => {
    const newErrors: Record<string, string> = {}

    questions.forEach(q => {
      if (q.required) {
        const value = answers[q.id]
        if (!value || value.trim() === '') {
          newErrors[q.id] = '此问题必须回答'
        }
      }
    })

    return newErrors
  }

  const handleSubmit = () => {
    console.log('[PlanQuestionsDialog] handleSubmit called')
    console.log('[PlanQuestionsDialog] Current answers:', answers)
    console.log('[PlanQuestionsDialog] Questions:', questions)
    const newErrors = validate()
    setErrors(newErrors)

    if (Object.keys(newErrors).length === 0) {
      console.log('[PlanQuestionsDialog] Validation passed, calling onSubmit')
      onSubmit(answers)
    } else {
      console.log('[PlanQuestionsDialog] Validation failed', newErrors)
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit()
    } else if (e.key === 'Escape') {
      onCancel()
    }
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
        className="relative w-full max-w-2xl bg-[var(--color-bg-panel)] backdrop-blur-xl rounded-xl border border-[var(--color-border-subtle)] shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-[var(--color-text)]">任务规划</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                请回答以下问题以完善执行计划
              </p>
            </div>
          </div>
          
          {taskDescription && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)]">
              <div className="text-xs text-[var(--color-text-muted)] mb-1">任务描述：</div>
              <div className="text-sm text-[var(--color-text)] line-clamp-2">
                {taskDescription}
              </div>
            </div>
          )}
        </div>
        
        {/* Questions */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {questions.map((question, index) => (
            <div key={question.id} className="space-y-2">
              <label className="flex items-start gap-2 text-sm font-medium text-[var(--color-text)]">
                <span className="text-[var(--color-text-muted)] mt-0.5">{index + 1}.</span>
                <span className="flex-1">{question.question}</span>
                {question.required && (
                  <span className="text-red-400 text-xs">*</span>
                )}
              </label>
              
              {/* Text Input */}
              {question.type === 'text' && (
                <input
                  type="text"
                  value={answers[question.id] || ''}
                  onChange={(e) => updateAnswer(question.id, e.target.value)}
                  placeholder={question.placeholder || '请输入...'}
                  className={`w-full px-3 py-2 bg-[var(--color-bg-input)] border rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:bg-[var(--color-bg-hover)] transition-all ${
                    errors[question.id]
                      ? 'border-red-500/50 focus:border-red-500'
                      : 'border-[var(--color-border-subtle)] focus:border-[var(--color-border)]'
                  }`}
                />
              )}
              
              {/* Textarea */}
              {question.type === 'textarea' && (
                <textarea
                  value={answers[question.id] || ''}
                  onChange={(e) => updateAnswer(question.id, e.target.value)}
                  placeholder={question.placeholder || '请输入...'}
                  rows={3}
                  className={`w-full px-3 py-2 bg-[var(--color-bg-input)] border rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:bg-[var(--color-bg-hover)] transition-all resize-none ${
                    errors[question.id]
                      ? 'border-red-500/50 focus:border-red-500'
                      : 'border-[var(--color-border-subtle)] focus:border-[var(--color-border)]'
                  }`}
                />
              )}
              
              {/* Number Input */}
              {question.type === 'number' && (
                <input
                  type="number"
                  value={answers[question.id] || ''}
                  onChange={(e) => updateAnswer(question.id, e.target.value)}
                  placeholder={question.placeholder || '请输入数字...'}
                  className={`w-full px-3 py-2 bg-[var(--color-bg-input)] border rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:bg-[var(--color-bg-hover)] transition-all ${
                    errors[question.id]
                      ? 'border-red-500/50 focus:border-red-500'
                      : 'border-[var(--color-border-subtle)] focus:border-[var(--color-border)]'
                  }`}
                />
              )}
              
              {/* Select */}
              {question.type === 'select' && question.options && (
                <select
                  value={answers[question.id] || ''}
                  onChange={(e) => updateAnswer(question.id, e.target.value)}
                  className={`w-full px-3 py-2 bg-[var(--color-bg-input)] border rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:bg-[var(--color-bg-hover)] transition-all ${
                    errors[question.id]
                      ? 'border-red-500/50 focus:border-red-500'
                      : 'border-[var(--color-border-subtle)] focus:border-[var(--color-border)]'
                  }`}
                >
                  <option value="">请选择...</option>
                  {question.options.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
              
              {/* Multiselect */}
              {question.type === 'multiselect' && question.options && (
                <div className="space-y-2">
                  {question.options.map((opt, i) => (
                    <label key={i} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(answers[question.id] || '').split(',').includes(opt)}
                        onChange={(e) => handleMultiSelect(question.id, opt, e.target.checked)}
                        className="w-4 h-4 rounded border-[var(--color-border-subtle)] bg-[var(--color-bg-input)] text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                      />
                      <span className="text-sm text-[var(--color-text)]">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
              
              {/* Boolean */}
              {question.type === 'boolean' && (
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={question.id}
                      value="true"
                      checked={answers[question.id] === 'true'}
                      onChange={(e) => updateAnswer(question.id, e.target.value)}
                      className="w-4 h-4 border-[var(--color-border-subtle)] bg-[var(--color-bg-input)] text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-[var(--color-text)]">是</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={question.id}
                      value="false"
                      checked={answers[question.id] === 'false'}
                      onChange={(e) => updateAnswer(question.id, e.target.value)}
                      className="w-4 h-4 border-[var(--color-border-subtle)] bg-[var(--color-bg-input)] text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-[var(--color-text)]">否</span>
                  </label>
                </div>
              )}
              
              {/* Error message */}
              {errors[question.id] && (
                <p className="text-xs text-red-400">{errors[question.id]}</p>
              )}
              
              {/* Placeholder hint */}
              {question.placeholder && question.type !== 'text' && question.type !== 'textarea' && question.type !== 'number' && (
                <p className="text-xs text-[var(--color-text-muted)]">
                  提示: {question.placeholder}
                </p>
              )}
            </div>
          ))}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between bg-[var(--color-bg-elevated)]">
          <div className="text-xs text-[var(--color-text-muted)]">
            提示: Ctrl+Enter 提交, Esc 取消
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-input)] rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? '正在生成...' : '生成计划'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
