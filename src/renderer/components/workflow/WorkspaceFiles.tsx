import { useState, useEffect } from 'react'
import { useWorkspaceStore } from '@/store/workspace-store'

export interface FileItem {
  name: string
  isDirectory: boolean
  path: string
}

export default function WorkspaceFiles({ 
  onClose, 
  onFileClick 
}: { 
  onClose: () => void
  onFileClick?: (file: FileItem) => void
}) {
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
    } else if (onFileClick) {
      onFileClick(file)
    }
  }

  const handleBack = () => {
    const parts = currentPath.split('/')
    parts.pop()
    setCurrentPath(parts.join('/'))
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg-panel)] backdrop-blur-md rounded-lg border border-[var(--color-border-subtle)] overflow-hidden">
      {/* Header with unified styling */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--color-border-subtle)]">
        <span className="text-xs font-medium text-[var(--color-text-muted)]">📁 文件</span>
        <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs transition-colors">
          ▼
        </button>
      </div>

      {/* Breadcrumb with consistent padding */}
      {currentPath && (
        <div className="p-3 border-b border-[var(--color-border-subtle)]">
          <button
            onClick={handleBack}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            ← 返回上级
          </button>
          <span className="text-xs text-[var(--color-text-subtle)] ml-2">/{currentPath}</span>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto p-2">
        {files.length === 0 ? (
          <div className="text-[var(--color-text-subtle)] text-xs text-center py-4">暂无文件</div>
        ) : (
          files.map((file) => (
            <div
              key={file.path}
              onClick={() => handleFileClick(file)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-bg-hover)] rounded cursor-pointer transition-colors"
            >
              <span>{file.isDirectory ? '📁' : '📄'}</span>
              <span className="text-xs truncate text-[var(--color-text)]">{file.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
