/**
 * 内联生成文件展示组件
 * 在输入框上方显示所有消息中生成的文件
 * 支持 Markdown 和 HTML 预览
 */

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, ChevronDown, ChevronUp, Eye, X, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GeneratedFileInfo } from '@/store/agent-store'
import type { AgentMessage } from '@/store/agent-store'
import ViewToggle, { ViewMode } from '@/components/workflow/preview/ViewToggle'
import MarkdownRenderer from '@/components/workflow/preview/MarkdownRenderer'
import HtmlRenderer from '@/components/workflow/preview/HtmlRenderer'

interface AgentInlineGeneratedFilesProps {
  messages: AgentMessage[]
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
    // 图片
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️', ico: '🖼️', bmp: '🖼️',
  }
  return iconMap[ext || ''] || '📄'
}

// 判断文件类型
type FileType = 'markdown' | 'html' | 'image' | 'code' | 'unknown'

function getFileType(filename: string): FileType {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  const markdownExts = ['md', 'markdown', 'mdown', 'mkd']
  const htmlExts = ['html', 'htm', 'xhtml']
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico']

  if (markdownExts.includes(ext)) return 'markdown'
  if (htmlExts.includes(ext)) return 'html'
  if (imageExts.includes(ext)) return 'image'
  if (ext) return 'code' // 有扩展名的文件都视为代码
  return 'unknown'
}

// 格式化文件大小
function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// 文件预览模态框 - 支持 Markdown 和 HTML 预览
function FilePreviewModal({
  file,
  onClose,
}: {
  file: GeneratedFileInfo
  onClose: () => void
}) {
  const [content, setContent] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('preview')

  const filename = file.path.split('/').pop() || file.path
  const fileType = getFileType(filename)

  // 判断是否显示视图切换按钮（markdown 和 html 支持）
  const showViewToggle = fileType === 'markdown' || fileType === 'html'

  // 加载文件内容
  useEffect(() => {
    const loadContent = async () => {
      console.log('[🏖️ FILE_PREVIEW] 开始加载文件预览', {
        workspacePath: file.workspacePath,
        path: file.path,
        fileType,
      })

      setLoading(true)
      setError(null)
      setViewMode('preview') // 文件切换时重置为预览模式

      try {
        if (fileType === 'image') {
          // 图片文件使用 readImage 方法
          const result = await window.electronAPI.file.readImage(file.workspacePath, file.path)
          console.log('[🏖️ FILE_PREVIEW] 图片读取结果', {
            success: result.success,
            hasDataUrl: !!result.dataUrl,
            error: result.error,
          })

          if (result.success && result.dataUrl) {
            setImageUrl(result.dataUrl)
          } else {
            console.error('[🏖️ FILE_PREVIEW] ❌ 图片读取失败', result.error)
            setError(result.error || '无法读取图片')
          }
        } else {
          // 普通文件使用 read 方法
          const result = await window.electronAPI.file.read(file.workspacePath, file.path)
          console.log('[🏖️ FILE_PREVIEW] 文件读取结果', {
            success: result.success,
            hasContent: result.content !== undefined,
            contentLength: result.content?.length,
            error: result.error,
          })

          if (result.success && result.content !== undefined) {
            // 限制显示内容长度
            const maxLen = 100000
            setContent(
              result.content.length > maxLen
                ? result.content.substring(0, maxLen) + '\n\n... (内容过长，已截断)'
                : result.content
            )
          } else {
            console.error('[🏖️ FILE_PREVIEW] ❌ 文件读取失败', result.error)
            setError(result.error || '无法读取文件')
          }
        }
      } catch (err) {
        console.error('[🏖️ FILE_PREVIEW] ❌ 文件读取异常', err)
        setError(err instanceof Error ? err.message : '读取文件失败')
      } finally {
        setLoading(false)
      }
    }
    loadContent()
  }, [file.workspacePath, file.path, fileType])

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleCopy = async () => {
    if (content) {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // 渲染预览内容
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-red-400">
          <FileText className="w-12 h-12 mb-2 opacity-50" />
          <p>{error}</p>
        </div>
      )
    }

    // 图片预览
    if (fileType === 'image' && imageUrl) {
      return (
        <div className="flex items-center justify-center p-4 overflow-auto max-h-[60vh]">
          <img
            src={imageUrl}
            alt={filename}
            className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
          />
        </div>
      )
    }

    // 源码视图
    if (viewMode === 'source' && content) {
      return (
        <pre className="text-sm font-mono whitespace-pre-wrap break-all p-4 text-[var(--color-text)] overflow-auto max-h-[60vh]">
          {content}
        </pre>
      )
    }

    // 预览视图
    switch (fileType) {
      case 'markdown':
        return <MarkdownRenderer content={content || ''} />
      case 'html':
        return <HtmlRenderer content={content || ''} />
      case 'code':
      default:
        return (
          <pre className="text-sm font-mono whitespace-pre-wrap break-all p-4 text-[var(--color-text)] overflow-auto max-h-[60vh]">
            {content}
          </pre>
        )
    }
  }

  // 获取文件类型标签颜色
  const getFileTypeColor = (type: FileType) => {
    switch (type) {
      case 'markdown':
        return 'bg-purple-500/20 text-purple-400'
      case 'html':
        return 'bg-orange-500/20 text-orange-400'
      case 'code':
        return 'bg-blue-500/20 text-blue-400'
      case 'image':
        return 'bg-green-500/20 text-green-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
    }
  }

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
        transition={{ duration: 0.2 }}
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
            <span className={cn(
              'text-xs px-2 py-0.5 rounded',
              getFileTypeColor(fileType)
            )}>
              {fileType === 'markdown' ? 'Markdown' :
               fileType === 'html' ? 'HTML' :
               fileType === 'image' ? 'Image' :
               fileType === 'code' ? 'Code' : 'File'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* 视图切换 */}
            {showViewToggle && !loading && !error && content && (
              <ViewToggle mode={viewMode} onChange={setViewMode} />
            )}
            {/* 复制按钮 */}
            {!loading && !error && content && fileType !== 'image' && (
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
        <div className="flex-1 overflow-auto">
          {renderContent()}
        </div>
      </motion.div>
    </motion.div>
  )
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

export default function AgentInlineGeneratedFiles({ messages }: AgentInlineGeneratedFilesProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [previewFile, setPreviewFile] = useState<GeneratedFileInfo | null>(null)

  // 聚合所有消息中的生成文件（去重）
  const allFiles = useMemo(() => {
    const fileMap = new Map<string, GeneratedFileInfo>()
    for (const msg of messages) {
      if (msg.generatedFiles && msg.generatedFiles.length > 0) {
        for (const file of msg.generatedFiles) {
          const key = `${file.workspacePath}:${file.path}`
          if (!fileMap.has(key)) {
            fileMap.set(key, file)
          }
        }
      }
    }
    const result = Array.from(fileMap.values())
    console.log('[🏖️ FILE_LIST] 聚合生成文件', {
      totalMessages: messages.length,
      messagesWithFiles: messages.filter(m => m.generatedFiles && m.generatedFiles.length > 0).length,
      totalFiles: result.length,
      files: result.map(f => ({ workspace: f.workspacePath, path: f.path, size: f.size })),
    })
    return result
  }, [messages])

  if (allFiles.length === 0) return null

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="glass-panel rounded-xl p-3 mb-2"
      >
        {/* 标题栏 - 可点击收起 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between mb-2 hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-green-400" />
            <span className="text-[var(--color-text)]">生成的文件</span>
            <span className="px-2 py-0.5 bg-[var(--color-bg-input)] rounded text-xs text-[var(--color-text-muted)]">
              {allFiles.length} 个
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          )}
        </button>

        {/* 文件列表 - 可收起 */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-2 max-h-48 overflow-y-auto">
                <AnimatePresence mode="popLayout">
                  {allFiles.map((file, index) => (
                    <FileItem
                      key={`${file.workspacePath}:${file.path}-${index}`}
                      file={file}
                      onPreview={() => setPreviewFile(file)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 预览模态框 */}
      <AnimatePresence>
        {previewFile && (
          <FilePreviewModal
            file={previewFile}
            onClose={() => setPreviewFile(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
