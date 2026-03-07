/**
 * 生成文件展示组件
 * 在 Agent 回复下方展示执行过程中生成的文件列表
 */

import { useState, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, ChevronDown, ChevronRight, Eye, X, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GeneratedFileInfo } from '@/store/agent-store'

interface GeneratedFilesBlockProps {
  files: GeneratedFileInfo[]
  className?: string
}

// 文件图标根据扩展名
function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase()
  const iconMap: Record<string, string> = {
    // 代码文件
    ts: '🔷', tsx: '🔷', js: '🟨', jsx: '🟨',
    py: '🐍', java: '☕', go: '🔵',
    // 配置文件
    json: '📋', yaml: '📄', yml: '📄', toml: '📄',
    // 文档
    md: '📝', txt: '📄', html: '🌐', css: '🎨',
    // 数据
    csv: '📊', xml: '📄',
  }
  return iconMap[ext || ''] || '📄'
}

// 格式化文件大小
function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// 单个文件项
function FileItem({ file, onPreview }: { file: GeneratedFileInfo; onPreview: () => void }) {
  const filename = file.path.split('/').pop() || file.path
  const dir = file.path.substring(0, file.path.lastIndexOf('/'))

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg',
        'bg-[var(--color-bg-input)] hover:bg-[var(--color-bg-hover)]',
        'border border-[var(--color-border-subtle)]',
        'cursor-pointer transition-all duration-200',
        'group'
      )}
      onClick={onPreview}
    >
      <span className="text-lg">{getFileIcon(filename)}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--color-text)] truncate">
          {filename}
        </div>
        {dir && (
          <div className="text-xs text-[var(--color-text-muted)] truncate">
            {dir}
          </div>
        )}
      </div>
      {file.size && (
        <span className="text-xs text-[var(--color-text-muted)]">
          {formatFileSize(file.size)}
        </span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onPreview()
        }}
        className={cn(
          'p-1 rounded transition-all',
          'opacity-0 group-hover:opacity-100',
          'hover:bg-[var(--color-bg-elevated)]'
        )}
        title="预览"
      >
        <Eye className="w-4 h-4 text-[var(--color-text-muted)]" />
      </button>
    </motion.div>
  )
}

// 文件预览模态框
function FilePreviewModal({
  file,
  onClose,
}: {
  file: GeneratedFileInfo
  onClose: () => void
}) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // 加载文件内容
  useEffect(() => {
    const loadContent = async () => {
      try {
        const result = await window.electronAPI.file.read(file.workspacePath, file.path)
        if (result.success && result.content !== undefined) {
          // 限制显示内容长度
          const maxLen = 50000
          setContent(
            result.content.length > maxLen
              ? result.content.substring(0, maxLen) + '\n\n... (内容过长，已截断)'
              : result.content
          )
        } else {
          setError(result.error || '无法读取文件')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '读取文件失败')
      } finally {
        setLoading(false)
      }
    }
    loadContent()
  }, [file.workspacePath, file.path])

  const handleCopy = async () => {
    if (content) {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const filename = file.path.split('/').pop() || file.path
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const isCode = ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'json', 'yaml', 'yml', 'html', 'css', 'md'].includes(ext)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className={cn(
          'w-full max-w-4xl max-h-[80vh] rounded-xl overflow-hidden',
          'bg-[var(--color-bg-elevated)] border border-[var(--color-border)]',
          'shadow-2xl flex flex-col'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getFileIcon(filename)}</span>
            <span className="font-medium text-[var(--color-text)]">{filename}</span>
            <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-input)] px-2 py-0.5 rounded">
              {ext.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!loading && !error && content && (
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                title="复制内容"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 文件路径 */}
        <div className="px-4 py-2 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-input)]/50 border-b border-[var(--color-border-subtle)]">
          📁 {file.workspacePath} / {file.path}
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : error ? (
            <div className="text-red-400 text-center py-8">{error}</div>
          ) : (
            <pre className={cn(
              'text-sm font-mono whitespace-pre-wrap break-all',
              isCode ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'
            )}>
              {content}
            </pre>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

export const GeneratedFilesBlock = memo(function GeneratedFilesBlock({
  files,
  className,
}: GeneratedFilesBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [previewFile, setPreviewFile] = useState<GeneratedFileInfo | null>(null)

  if (files.length === 0) return null

  return (
    <div className={cn('mt-3', className)}>
      {/* 标题栏 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2 rounded-lg',
          'bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-hover)]',
          'border border-[var(--color-border-subtle)]',
          'text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
          'transition-all duration-200'
        )}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        <FileText className="w-4 h-4" />
        <span>生成的文件</span>
        <span className="ml-auto px-2 py-0.5 bg-[var(--color-bg-input)] rounded text-xs">
          {files.length} 个
        </span>
      </button>

      {/* 文件列表 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid gap-2 mt-2">
              {files.map((file, index) => (
                <FileItem
                  key={`${file.path}-${index}`}
                  file={file}
                  onPreview={() => setPreviewFile(file)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 预览模态框 */}
      <AnimatePresence>
        {previewFile && (
          <FilePreviewModal
            file={previewFile}
            onClose={() => setPreviewFile(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
})

export default GeneratedFilesBlock
