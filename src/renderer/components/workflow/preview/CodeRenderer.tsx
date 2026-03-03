import { useEffect, useRef } from 'react'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

// 文件扩展名到语言的映射
const extToLanguage: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  jsx: 'javascript',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  lua: 'lua',
  r: 'r',
  sql: 'sql',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  ps1: 'powershell',
  dockerfile: 'dockerfile',
  make: 'makefile',
  cmake: 'cmake',
  toml: 'toml',
  ini: 'ini',
  conf: 'ini',
  vue: 'vue',
  svelte: 'svelte',
  md: 'markdown',
}

interface CodeRendererProps {
  content: string
  filename?: string
}

export default function CodeRenderer({ content, filename }: CodeRendererProps) {
  const codeRef = useRef<HTMLElement>(null)

  // 获取语言
  const getLanguage = (): string | undefined => {
    if (!filename) return undefined
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    return extToLanguage[ext]
  }

  const language = getLanguage()

  useEffect(() => {
    if (codeRef.current) {
      // 清除之前的高亮
      delete codeRef.current.dataset.highlighted
      codeRef.current.innerHTML = ''

      if (language) {
        try {
          const result = hljs.highlight(content, { language })
          codeRef.current.innerHTML = result.value
        } catch {
          // 如果指定语言失败，使用自动检测
          const result = hljs.highlightAuto(content)
          codeRef.current.innerHTML = result.value
        }
      } else {
        // 自动检测语言
        const result = hljs.highlightAuto(content)
        codeRef.current.innerHTML = result.value
      }
    }
  }, [content, language])

  return (
    <pre className="p-4 overflow-auto max-h-[60vh] text-sm bg-[var(--color-bg-input)] rounded-lg border border-[var(--color-border-subtle)]">
      <code
        ref={codeRef}
        className={`language-${language || 'plaintext'} font-mono`}
      >
        {content}
      </code>
    </pre>
  )
}
