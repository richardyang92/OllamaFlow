import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useWorkflowStore } from '@/store/workflow-store'
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
  { id: 'location', title: '选择位置', icon: '📁' },
  { id: 'basic', title: '基本信息', icon: '✏️' },
  { id: 'ai', title: 'AI 配置', icon: '🤖' },
  { id: 'confirm', title: '确认创建', icon: '✅' },
]

export default function NewProjectWizard() {
  const { setCurrentWorkspace, setCurrentPage } = useWorkspaceStore()
  const { setWorkflow } = useWorkflowStore()

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
      // Generate workflow from template
      const workflow = generateTemplateWorkflow(
        state.selectedTemplate,
        state.projectName,
        state.defaultModel
      )

      // Create workspace
      const result = await window.electronAPI.workspace.init(state.projectPath, {
        name: state.projectName,
        description: state.description,
        ollamaHost: state.apiEndpoint,
        defaultModel: state.defaultModel,
        initialWorkflow: workflow,
      })

      // Save API Key to secure storage if provided (for OpenAI-compatible APIs)
      if (state.apiKey && state.aiBackend === 'openai') {
        await window.electronAPI.openai.setApiKey('workspace-default', state.apiKey)
      }

      // Set current workspace and workflow
      setCurrentWorkspace(state.projectPath, result.config)
      setWorkflow(workflow)

      // Navigate to editor (currentPage will automatically switch to 'editor' when currentWorkspace is set)
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
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4">
      {/* Background effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-blue-900/10" />
      </div>

      <div className="w-full max-w-2xl relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">✨ 新建项目</h1>
          <p className="text-zinc-400">创建一个新的 OllamaFlow 工作区</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => index < state.currentStep && setState((s) => ({ ...s, currentStep: index }))}
                disabled={index > state.currentStep}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
                  index === state.currentStep
                    ? 'bg-blue-500/20 text-blue-400'
                    : index < state.currentStep
                    ? 'bg-white/5 text-zinc-300 hover:bg-white/10 cursor-pointer'
                    : 'text-zinc-600 cursor-not-allowed'
                )}
              >
                <span>{step.icon}</span>
                <span className="text-sm hidden sm:inline">{step.title}</span>
              </button>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'w-8 h-0.5 mx-1',
                    index < state.currentStep ? 'bg-blue-500/50' : 'bg-white/10'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 mb-6">
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
          >
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={state.currentStep === 0 ? handleCancel : handleBack}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
          >
            {state.currentStep === 0 ? '取消' : '← 上一步'}
          </button>

          <div className="flex items-center gap-2">
            {state.currentStep === steps.length - 1 ? (
              <button
                onClick={handleCreate}
                disabled={!canGoNext() || isCreating}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
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
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一步 →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
