import { useWorkspaceStore } from '@/store/workspace-store'
import WelcomePage from '@/pages/Welcome'
import EditorPage from '@/pages/Editor'

function App() {
  const { currentWorkspace } = useWorkspaceStore()

  if (!currentWorkspace) {
    return <WelcomePage />
  }

  return <EditorPage />
}

export default App
