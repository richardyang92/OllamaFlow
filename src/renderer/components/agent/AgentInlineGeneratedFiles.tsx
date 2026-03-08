/**
 * 内联生成文件展示组件
 * 在输入框上方显示所有消息中生成的文件
 */

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, ChevronDown, ChevronUp, Eye, X, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GeneratedFileInfo } from '@/store/agent-store'
import type { AgentMessage } from '@/store/agent-store'

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
      console.log('[🏖️ FILE_PREVIEW] 开始加载文件预览', {
        workspacePath: file.workspacePath,
        path: file.path,
      })

      try {
        const result = await window.electronAPI.file.read(file.workspacePath, file.path)
        console.log('[🏖️ FILE_PREVIEW] 文件读取结果', {
          success: result.success,
          hasContent: result.content !== undefined,
          contentLength: result.content?.length,
          error: result.error,
        })

        if (result.success && result.content !== undefined) {
          // 限制显示内容长度
          const maxLen = 50000
          setContent(
            result.content.length > maxLen
              ? result.content.substring(0, maxLen) + '\n\n... (内容过长，已截断)'
              : result.content
          )
        } else {
          console.error('[🏖️ FILE_PREVIEW] ❌ 文件读取失败', result.error)
          setError(result.error || '无法读取文件')
        }
      } catch (err) {
        console.error('[🏖️ FILE_PREVIEW] ❌ 文件读取异常', err)
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
      messagesWithFiles: messages.filter(m => m.generatedFiles?.length > 0).length,
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
