import { useWorkspaceStore } from '@/store/workspace-store'
import WelcomePage from '@/pages/Welcome'
import EditorPage from '@/pages/Editor'
import NewProjectWizard from '@/pages/NewProjectWizard'
import AgentPage from '@/pages/AgentPage'

function App() {
  const { currentWorkspace, currentPage } = useWorkspaceStore()

  // If there's a workspace, always show editor
  if (currentWorkspace) {
    return <EditorPage />
  }

  // Otherwise, check the current page
  if (currentPage === 'wizard') {
    return <NewProjectWizard />
  }

  if (currentPage === 'agent') {
    return <AgentPage />
  }

  return <WelcomePage />
}

export default App
