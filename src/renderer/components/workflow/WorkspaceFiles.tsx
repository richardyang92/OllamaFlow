import { useState, useEffect, useCallback } from 'react'
import { useWorkspaceStore } from '@/store/workspace-store'

export interface FileItem {
  name: string
  isDirectory: boolean
  path: string
}

function getFileIcon(filename: string, isDirectory: boolean): string {
  if (isDirectory) return '📁'
  
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  
  const iconMap: Record<string, string> = {
    js: '📜',
    jsx: '⚛️',
    ts: '📘',
    tsx: '⚛️',
    py: '🐍',
    java: '☕',
    cpp: '⚡',
    c: '⚡',
    go: '🐹',
    rs: '🦀',
    rb: '💎',
    php: '🐘',
    swift: '🍎',
    kt: '📱',
    
    json: '📋',
    yaml: '⚙️',
    yml: '⚙️',
    xml: '📄',
    toml: '⚙️',
    ini: '⚙️',
    env: '🔐',
    
    md: '📝',
    txt: '📄',
    rst: '📝',
    adoc: '📖',
    
    html: '🌐',
    htm: '🌐',
    css: '🎨',
    scss: '🎨',
    sass: '🎨',
    less: '🎨',
    
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    svg: '🖼️',
    webp: '🖼️',
    ico: '🖼️',
    bmp: '🖼️',
    
    mp4: '🎬',
    avi: '🎬',
    mov: '🎬',
    wmv: '🎬',
    flv: '🎬',
    webm: '🎬',
    mkv: '🎬',
    
    mp3: '🎵',
    wav: '🎵',
    ogg: '🎵',
    flac: '🎵',
    aac: '🎵',
    m4a: '🎵',
    
    pdf: '📕',
    doc: '📘',
    docx: '📘',
    xls: '📊',
    xlsx: '📊',
    ppt: '📊',
    pptx: '📊',
    
    zip: '📦',
    tar: '📦',
    gz: '📦',
    rar: '📦',
    '7z': '📦',
    bz2: '📦',
    
    sql: '🗃️',
    db: '🗃️',
    sqlite: '🗃️',
    
    sh: '💻',
    bash: '💻',
    zsh: '💻',
    bat: '💻',
    cmd: '💻',
    ps1: '💻',
  }
  
  return iconMap[ext] || '📄'
}

export default function WorkspaceFiles({
  onClose,
  onFileClick,
  isDrawer = false,
}: {
  onClose: () => void
  onFileClick?: (file: FileItem) => void
  isDrawer?: boolean
}) {
  const { currentWorkspace } = useWorkspaceStore()
  const [files, setFiles] = useState<FileItem[]>([])
  const [currentPath, setCurrentPath] = useState('')

  const loadFiles = useCallback(async (path: string) => {
    if (!currentWorkspace) return
    const result = await window.electronAPI.file.list(currentWorkspace.path, path)
    if (result.success && result.files) {
      setFiles(result.files.filter((f) => !f.name.startsWith('.')))
    }
  }, [currentWorkspace])

  useEffect(() => {
    if (currentWorkspace) {
      loadFiles(currentPath)
    }
  }, [currentWorkspace, currentPath, loadFiles])

  useEffect(() => {
    if (!currentWorkspace) return

    window.electronAPI.fileWatcher.start(currentWorkspace.path)
    
    const unsubscribe = window.electronAPI.fileWatcher.onChanged(() => {
      loadFiles(currentPath)
    })

    return () => {
      unsubscribe()
      window.electronAPI.fileWatcher.stop(currentWorkspace.path)
    }
  }, [currentWorkspace, currentPath, loadFiles])

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
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header - only show when not in drawer mode */}
      {!isDrawer && (
        <div className="flex items-center justify-between p-3 border-b border-[var(--color-border-subtle)]">
          <span className="text-xs font-medium text-[var(--color-text-muted)]">📁 文件</span>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs transition-colors">
            ▼
          </button>
        </div>
      )}

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
              <span>{getFileIcon(file.name, file.isDirectory)}</span>
              <span className="text-xs truncate text-[var(--color-text)]">{file.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
