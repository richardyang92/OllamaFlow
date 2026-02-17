import { useState, useEffect } from 'react'
import { useWorkspaceStore } from '@/store/workspace-store'

interface FileItem {
  name: string
  isDirectory: boolean
  path: string
}

export default function WorkspaceFiles({ onClose }: { onClose: () => void }) {
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
    <div className="h-full flex flex-col bg-panel-bg backdrop-blur-md rounded-lg border border-white/5 overflow-hidden">
      {/* Header with unified styling */}
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <span className="text-xs font-medium text-zinc-400">📁 文件</span>
        <button onClick={onClose} className="text-zinc-400 hover:text-white text-xs transition-colors">
          ▼
        </button>
      </div>

      {/* Breadcrumb with consistent padding */}
      {currentPath && (
        <div className="p-3 border-b border-white/10">
          <button
            onClick={handleBack}
            className="text-xs text-zinc-400 hover:text-white transition-colors"
          >
            ← 返回上级
          </button>
          <span className="text-xs text-zinc-500 ml-2">/{currentPath}</span>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto p-2">
        {files.length === 0 ? (
          <div className="text-zinc-500 text-xs text-center py-4">暂无文件</div>
        ) : (
          files.map((file) => (
            <div
              key={file.path}
              onClick={() => handleFileClick(file)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded cursor-pointer transition-colors"
            >
              <span>{file.isDirectory ? '📁' : '📄'}</span>
              <span className="text-xs truncate text-zinc-300">{file.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
