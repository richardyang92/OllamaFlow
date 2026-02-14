import { useState, useEffect } from 'react'
import { useWorkspaceStore } from '@/store/workspace-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { createEmptyWorkflow } from '@/types/workflow'

export default function WelcomePage() {
  const { setCurrentWorkspace, setRecentWorkspaces, recentWorkspaces } = useWorkspaceStore()
  const { setWorkflow } = useWorkflowStore()
  const [isLoading, setIsLoading] = useState(false)

  // Load recent workspaces on mount
  useEffect(() => {
    window.electronAPI.recent.get().then(setRecentWorkspaces)
  }, [setRecentWorkspaces])

  const handleOpenWorkspace = async () => {
    setIsLoading(true)
    try {
      const path = await window.electronAPI.workspace.open()
      if (!path) {
        setIsLoading(false)
        return
      }

      // Check if it's an existing workspace
      const config = await window.electronAPI.workspace.readConfig(path)

      if (config) {
        // Existing workspace
        setCurrentWorkspace(path, config)
        const workflow = await window.electronAPI.workspace.readWorkflow(path)
        if (workflow) {
          setWorkflow(workflow)
        } else {
          setWorkflow(createEmptyWorkflow(config.name))
        }
      } else {
        // New workspace - ask for name
        const name = path.split(/[/\\]/).pop() || 'New Workspace'
        const { config: newConfig, workflow: newWorkflow } =
          await window.electronAPI.workspace.init(path, { name })
        setCurrentWorkspace(path, newConfig)
        setWorkflow(newWorkflow)
      }
    } catch (error) {
      console.error('Failed to open workspace:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenRecent = async (path: string, name: string) => {
    setIsLoading(true)
    try {
      const config = await window.electronAPI.workspace.readConfig(path)
      if (config) {
        setCurrentWorkspace(path, config)
        const workflow = await window.electronAPI.workspace.readWorkflow(path)
        if (workflow) {
          setWorkflow(workflow)
        } else {
          setWorkflow(createEmptyWorkflow(config.name))
        }
      }
    } catch (error) {
      console.error('Failed to open recent workspace:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4">🤖 OllamaFlow</h1>
        <p className="text-gray-400 text-lg">Visual workflow builder for Ollama models</p>
      </div>

      <div className="space-y-4 w-80">
        <button
          onClick={handleOpenWorkspace}
          disabled={isLoading}
          className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Loading...' : '📂 Open Workspace'}
        </button>

        <p className="text-center text-gray-500 text-sm">
          Select a folder to create or open a workspace
        </p>
      </div>

      {recentWorkspaces.length > 0 && (
        <div className="mt-12 w-96">
          <h2 className="text-sm font-medium text-gray-400 mb-3">Recent Workspaces</h2>
          <div className="space-y-2">
            {recentWorkspaces.map((workspace) => (
              <button
                key={workspace.path}
                onClick={() => handleOpenRecent(workspace.path, workspace.name)}
                disabled={isLoading}
                className="w-full text-left py-2 px-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">📁</span>
                  <div>
                    <div className="font-medium">{workspace.name}</div>
                    <div className="text-sm text-gray-500 truncate">{workspace.path}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="absolute bottom-6 text-gray-600 text-sm">
        v0.1.0 • Powered by Ollama
      </div>
    </div>
  )
}
