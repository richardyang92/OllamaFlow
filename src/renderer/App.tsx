import { useWorkspaceStore } from '@/store/workspace-store'
import WelcomePage from '@/pages/Welcome'
import EditorPage from '@/pages/Editor'
import NewProjectWizard from '@/pages/NewProjectWizard'

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

  return <WelcomePage />
}

export default App
