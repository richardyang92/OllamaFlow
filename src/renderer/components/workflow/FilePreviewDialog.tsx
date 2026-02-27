import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { X, FileText, Image, File, Loader2 } from 'lucide-react'
import { useWorkspaceStore } from '@/store/workspace-store'
import { cn } from '@/lib/utils'

interface FileItem {
  name: string
  isDirectory: boolean
  path: string
}

interface Props {
  file: FileItem
  onClose: () => void
}

type FileType = 'text' | 'image' | 'pdf' | 'unknown'

const getFileType = (filename: string): FileType => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  
  const textExts = ['txt', 'md', 'json', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'yaml', 'yml', 'xml', 'csv', 'log', 'ini', 'conf', 'sh', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp', 'vue', 'svelte']
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico']
  const pdfExts = ['pdf']
  
  if (textExts.includes(ext)) return 'text'
  if (imageExts.includes(ext)) return 'image'
  if (pdfExts.includes(ext)) return 'pdf'
  return 'unknown'
}

const getFileIcon = (fileType: FileType) => {
  switch (fileType) {
    case 'text':
      return FileText
    case 'image':
      return Image
    default:
      return File
  }
}

export default function FilePreviewDialog({ file, onClose }: Props) {
  const { currentWorkspace } = useWorkspaceStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [imageData, setImageData] = useState<string>('')
  const [pdfData, setPdfData] = useState<string>('')
  
  const fileType = getFileType(file.name)
  const FileIcon = getFileIcon(fileType)

  useEffect(() => {
    loadFileContent()
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [file, currentWorkspace])

  const loadFileContent = async () => {
    if (!currentWorkspace) return
    
    setLoading(true)
    setError(null)
    
    try {
      if (fileType === 'text') {
        const result = await window.electronAPI.file.read(currentWorkspace.path, file.path)
        if (result.success && result.content) {
          setContent(result.content)
        } else {
          setError(result.error || '读取文件失败')
        }
      } else if (fileType === 'image') {
        const result = await window.electronAPI.file.readImage(currentWorkspace.path, file.path)
        if (result.success && result.dataUrl) {
          setImageData(result.dataUrl)
        } else {
          setError(result.error || '读取图片失败')
        }
      } else if (fileType === 'pdf') {
        const result = await window.electronAPI.file.readPdf(currentWorkspace.path, file.path)
        if (result.success && result.dataUrl) {
          setPdfData(result.dataUrl)
        } else {
          setError(result.error || '读取PDF失败')
        }
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-muted)]" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-red-400">
          <File className="w-12 h-12 mb-2 opacity-50" />
          <p>{error}</p>
        </div>
      )
    }

    switch (fileType) {
      case 'text':
        return (
          <pre className="p-4 overflow-auto max-h-[60vh] text-sm text-[var(--color-text)] bg-[var(--color-bg-input)] rounded-lg font-mono whitespace-pre-wrap break-all">
            {content}
          </pre>
        )
      case 'image':
        return (
          <div className="flex items-center justify-center p-4 overflow-auto max-h-[60vh]">
            <img 
              src={imageData} 
              alt={file.name}
              className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
            />
          </div>
        )
      case 'pdf':
        return (
          <div className="p-4">
            <iframe
              src={pdfData}
              className="w-full h-[60vh] rounded-lg border border-[var(--color-border-subtle)]"
              title={file.name}
            />
          </div>
        )
      default:
        return (
          <div className="flex flex-col items-center justify-center h-64 text-[var(--color-text-muted)]">
            <File className="w-12 h-12 mb-2 opacity-50" />
            <p>此文件类型暂不支持预览</p>
          </div>
        )
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-3xl bg-[var(--color-bg-panel)] backdrop-blur-xl rounded-xl border border-[var(--color-border-subtle)] shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg',
                fileType === 'text' && 'bg-blue-500/20 text-blue-400',
                fileType === 'image' && 'bg-green-500/20 text-green-400',
                fileType === 'pdf' && 'bg-red-500/20 text-red-400',
                fileType === 'unknown' && 'bg-gray-500/20 text-gray-400'
              )}>
                <FileIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-medium text-[var(--color-text)] truncate max-w-md">
                  {file.name}
                </h2>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {file.path}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-auto max-h-[70vh]">
            {renderPreview()}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
