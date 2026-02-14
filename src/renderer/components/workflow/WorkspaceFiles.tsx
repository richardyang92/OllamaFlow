import { useState, useEffect } from 'react'
import { useWorkspaceStore } from '@/store/workspace-store'

interface FileItem {
  name: string
  isDirectory: boolean
  path: string
}

export default function WorkspaceFiles({ onToggle }: { onToggle: () => void }) {
  const { currentWorkspace } = useWorkspaceStore()
  const [files, setFiles] = useState<FileItem[]>([])
  const [currentPath, setCurrentPath] = useState('')

  useEffect(() => {
    if (currentWorkspace) {
      loadFiles(currentPath)
    }
  }, [currentWorkspace, currentPath])

  const loadFiles = async (path: string) => {
    if (!currentWorkspace) return
    const result = await window.electronAPI.file.list(currentWorkspace.path, path)
    if (result.success && result.files) {
      // Filter out .ollamaflow directory
      setFiles(result.files.filter((f) => !f.name.startsWith('.')))
    }
  }

  const handleFileClick = (file: FileItem) => {
    if (file.isDirectory) {
      setCurrentPath(file.path)
    }
  }

  const handleBack = () => {
    const parts = currentPath.split('/')
    parts.pop()
    setCurrentPath(parts.join('/'))
  }

  return (
    <div className="h-full flex flex-col bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-gray-700">
        <span className="text-xs font-medium text-gray-400">📁 Files</span>
        <button onClick={onToggle} className="text-gray-400 hover:text-white text-xs">
          ▼
        </button>
      </div>

      {/* Breadcrumb */}
      {currentPath && (
        <div className="p-2 border-b border-gray-700">
          <button
            onClick={handleBack}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            ← ..
          </button>
          <span className="text-xs text-gray-400 ml-2">/{currentPath}</span>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto p-1">
        {files.length === 0 ? (
          <div className="text-gray-500 text-xs text-center py-4">No files</div>
        ) : (
          files.map((file) => (
            <div
              key={file.path}
              onClick={() => handleFileClick(file)}
              className="flex items-center gap-2 px-2 py-1 hover:bg-gray-700 rounded cursor-pointer"
            >
              <span>{file.isDirectory ? '📁' : '📄'}</span>
              <span className="text-xs truncate">{file.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
