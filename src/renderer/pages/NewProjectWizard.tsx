import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Loader2, FolderCog, FileText, Bot, Check, Sun, Moon, Monitor } from 'lucide-react'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { useTheme, type ThemeMode } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import LocationStep from '@/components/wizard/steps/LocationStep'
import BasicInfoStep from '@/components/wizard/steps/BasicInfoStep'
import AIConfigStep from '@/components/wizard/steps/AIConfigStep'
import ConfirmStep from '@/components/wizard/steps/ConfirmStep'
import { generateTemplateWorkflow } from '@/components/wizard/templates'

type AIBackend = 'ollama' | 'openai'

interface WizardState {
  currentStep: number
  projectPath: string | null
  projectName: string
  description: string
  aiBackend: AIBackend
  apiEndpoint: string
  apiKey: string
  defaultModel: string
  selectedTemplate: string
}

const steps = [
  { id: 'location', title: '选择位置', icon: FolderCog },
  { id: 'basic', title: '基本信息', icon: FileText },
  { id: 'ai', title: 'AI 配置', icon: Bot },
  { id: 'confirm', title: '确认创建', icon: Check },
]

export default function NewProjectWizard() {
  const { setCurrentWorkspace, setCurrentPage, setRecentWorkspaces } = useWorkspaceStore()
  const { setWorkflow } = useWorkflowStore()
  const { themeMode, setThemeMode, resolvedTheme } = useTheme()

  const [state, setState] = useState<WizardState>({
    currentStep: 0,
    projectPath: null,
    projectName: '',
    description: '',
    aiBackend: 'ollama',
    apiEndpoint: 'http://127.0.0.1:11434',
    apiKey: '',
    defaultModel: '',
    selectedTemplate: 'empty',
  })

  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleThemeToggle = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system']
    const currentIndex = modes.indexOf(themeMode)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    setThemeMode(nextMode)
  }

  const ThemeIcon = themeMode === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun

  const canGoNext = () => {
    switch (state.currentStep) {
      case 0:
        return !!state.projectPath
      case 1:
        return !!state.projectName.trim()
      case 2:
        return !!state.defaultModel.trim()
      case 3:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (canGoNext() && state.currentStep < steps.length - 1) {
      setState((s) => ({ ...s, currentStep: s.currentStep + 1 }))
    }
  }

  const handleBack = () => {
    if (state.currentStep > 0) {
      setState((s) => ({ ...s, currentStep: s.currentStep - 1 }))
    }
  }

  const handleCancel = () => {
    setCurrentPage('welcome')
  }

  const handleCreate = async () => {
    if (!state.projectPath || !state.projectName.trim() || !state.defaultModel.trim()) {
      setError('请填写所有必填项')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const workflow = generateTemplateWorkflow(
        state.selectedTemplate,
        state.projectName,
        state.defaultModel
      )

      const result = await window.electronAPI.workspace.init(state.projectPath, {
        name: state.projectName,
        description: state.description,
        ollamaHost: state.apiEndpoint,
        defaultModel: state.defaultModel,
        initialWorkflow: workflow,
      })

      if (state.apiKey && state.aiBackend === 'openai') {
        await window.electronAPI.openai.setApiKey('workspace-default', state.apiKey)
      }

      await window.electronAPI.recent.add(state.projectPath, result.config.name)
      setCurrentWorkspace(state.projectPath, result.config)
      setWorkflow(workflow)
      
      const updatedRecentWorkspaces = await window.electronAPI.recent.get()
      setRecentWorkspaces(updatedRecentWorkspaces)
    } catch (err) {
      setError(`创建失败: ${(err as Error).message}`)
    } finally {
      setIsCreating(false)
    }
  }

  const renderStep = () => {
    switch (state.currentStep) {
      case 0:
        return (
          <LocationStep
            value={state.projectPath}
            onChange={(path) => setState((s) => ({ ...s, projectPath: path }))}
          />
        )
      case 1:
        return (
          <BasicInfoStep
            projectName={state.projectName}
            description={state.description}
            onNameChange={(name) => setState((s) => ({ ...s, projectName: name }))}
            onDescriptionChange={(desc) => setState((s) => ({ ...s, description: desc }))}
          />
        )
      case 2:
        return (
          <AIConfigStep
            aiBackend={state.aiBackend}
            apiEndpoint={state.apiEndpoint}
            apiKey={state.apiKey}
            defaultModel={state.defaultModel}
            onBackendChange={(backend) => setState((s) => ({ ...s, aiBackend: backend }))}
            onEndpointChange={(endpoint) => setState((s) => ({ ...s, apiEndpoint: endpoint }))}
            onApiKeyChange={(key) => setState((s) => ({ ...s, apiKey: key }))}
            onModelChange={(model) => setState((s) => ({ ...s, defaultModel: model }))}
          />
        )
      case 3:
        return (
          <ConfirmStep
            projectPath={state.projectPath || ''}
            projectName={state.projectName}
            description={state.description}
            aiBackend={state.aiBackend}
            apiEndpoint={state.apiEndpoint}
            defaultModel={state.defaultModel}
            selectedTemplate={state.selectedTemplate}
            onTemplateChange={(template) => setState((s) => ({ ...s, selectedTemplate: template }))}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-canvas)] flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />
      </div>

      <motion.button
        onClick={handleThemeToggle}
        className={cn(
          'fixed top-6 right-6 z-20',
          'w-10 h-10 rounded-full',
          'flex items-center justify-center',
          'glass-floating',
          'text-[var(--color-text-muted)]',
          'hover:text-[var(--color-text)]',
          'transition-all duration-200'
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title={`主题: ${themeMode === 'system' ? '跟随系统' : themeMode === 'dark' ? '深色' : '浅色'}`}
      >
        <ThemeIcon className="w-5 h-5" />
      </motion.button>

      <div className="w-full max-w-2xl relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2 bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
            新建项目
          </h1>
          <p className="text-[var(--color-text-muted)]">创建一个新的 OllamaFlow 工作区</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((step, index) => {
            const StepIcon = step.icon
            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => index < state.currentStep && setState((s) => ({ ...s, currentStep: index }))}
                  disabled={index > state.currentStep}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
                    index === state.currentStep
                      ? 'bg-blue-500/20 text-blue-400'
                      : index < state.currentStep
                      ? 'bg-[var(--color-bg-input)] text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] cursor-pointer'
                      : 'text-[var(--color-text-muted)] cursor-not-allowed opacity-50'
                  )}
                >
                  <StepIcon className="w-4 h-4" />
                  <span className="text-sm hidden sm:inline">{step.title}</span>
                </button>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'w-8 h-0.5 mx-1',
                      index < state.currentStep ? 'bg-blue-500/50' : 'bg-[var(--color-border-subtle)]'
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>

        <div className="glass-panel p-6 mb-6">
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
          >
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={state.currentStep === 0 ? handleCancel : handleBack}
            className={cn(
              'px-4 py-2 text-sm rounded-lg transition-all',
              'text-[var(--color-text-muted)]',
              'hover:text-[var(--color-text)]',
              'hover:bg-[var(--color-bg-input)]'
            )}
          >
            <span className="flex items-center gap-1">
              {state.currentStep === 0 ? '取消' : (
                <>
                  <ArrowLeft className="w-4 h-4" />
                  上一步
                </>
              )}
            </span>
          </button>

          <div className="flex items-center gap-2">
            {state.currentStep === steps.length - 1 ? (
              <button
                onClick={handleCreate}
                disabled={!canGoNext() || isCreating}
                className={cn(
                  'px-6 py-2 rounded-lg transition-all font-medium',
                  'bg-gradient-to-r from-purple-500/80 to-blue-500/80',
                  'hover:from-purple-500 hover:to-blue-500',
                  'text-white',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isCreating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    创建中...
                  </span>
                ) : (
                  '创建项目'
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!canGoNext()}
                className={cn(
                  'px-6 py-2 rounded-lg transition-all font-medium',
                  'bg-gradient-to-r from-purple-500/80 to-blue-500/80',
                  'hover:from-purple-500 hover:to-blue-500',
                  'text-white',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <span className="flex items-center gap-1">
                  下一步
                  <ArrowRight className="w-4 h-4" />
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
