import { useEffect } from 'react'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useSettingsStore } from '@/store/settings-store'
import WelcomePage from '@/pages/Welcome'
import EditorPage from '@/pages/Editor'
import NewProjectWizard from '@/pages/NewProjectWizard'
import AgentPage from '@/pages/AgentPage'

function App() {
  const { currentWorkspace, currentPage, goToAgent } = useWorkspaceStore()
  const loadGlobalAIConfig = useSettingsStore((state) => state.loadGlobalAIConfig)

  // 应用启动时加载全局 AI 配置
  useEffect(() => {
    loadGlobalAIConfig()
  }, [loadGlobalAIConfig])

  // 路由分发
  switch (currentPage) {
    case 'editor':
      return <EditorPage />
    case 'wizard':
      return <NewProjectWizard />
    case 'welcome':
      return <WelcomePage />
    case 'agent':
    default:
      return <AgentPage />
  }
}

export default App
