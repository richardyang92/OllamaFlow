import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import { useMemo } from 'react'
import MermaidRenderer from './MermaidRenderer'
import 'highlight.js/styles/github-dark.css'
import 'katex/dist/katex.min.css'
import '@/styles/markdown.css'

interface MarkdownRendererProps {
  content: string
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  // 提取 mermaid 代码块
  const mermaidBlocks = useMemo(() => {
    const blocks: { id: string; code: string }[] = []
    const regex = /```mermaid\n([\s\S]*?)```/g
    let match
    let id = 0
    while ((match = regex.exec(content)) !== null) {
      blocks.push({ id: `mermaid-${id++}`, code: match[1].trim() })
    }
    return blocks
  }, [content])

  // 移除 mermaid 代码块后的内容
  const contentWithoutMermaid = useMemo(() => {
    return content.replace(/```mermaid\n[\s\S]*?```/g, '')
  }, [content])

  return (
    <div className="markdown-body p-4 overflow-auto max-h-[60vh]">
      {mermaidBlocks.length > 0 && (
        <div className="space-y-4 mb-6">
          {mermaidBlocks.map((block) => (
            <div key={block.id} className="bg-[var(--color-bg-input)] rounded-lg p-4 border border-[var(--color-border-subtle)]">
              <MermaidRenderer chart={block.code} />
            </div>
          ))}
        </div>
      )}
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          // 自定义代码块渲染
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match

            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 bg-[var(--color-bg-input)] rounded text-sm font-mono text-[var(--color-accent)]"
                  {...props}
                >
                  {children}
                </code>
              )
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
          // 自定义 pre 渲染
          pre({ children }) {
            return (
              <pre className="my-3 p-4 bg-[var(--color-bg-input)] rounded-lg border border-[var(--color-border-subtle)] overflow-x-auto">
                {children}
              </pre>
            )
          },
          // 自定义表格渲染
          table({ children }) {
            return (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full border-collapse border border-[var(--color-border-subtle)] rounded-lg">
                  {children}
                </table>
              </div>
            )
          },
          th({ children }) {
            return (
              <th className="border border-[var(--color-border-subtle)] px-3 py-2 bg-[var(--color-bg-input)] text-left font-medium">
                {children}
              </th>
            )
          },
          td({ children }) {
            return (
              <td className="border border-[var(--color-border-subtle)] px-3 py-2">
                {children}
              </td>
            )
          },
          // 自定义引用渲染
          blockquote({ children }) {
            return (
              <blockquote className="my-4 pl-4 border-l-4 border-[var(--color-accent)] text-[var(--color-text-muted)] italic">
                {children}
              </blockquote>
            )
          },
          // 自定义链接渲染
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline"
              >
                {children}
              </a>
            )
          },
          // 自定义标题渲染
          h1({ children }) {
            return <h1 className="text-2xl font-bold mt-6 mb-4 pb-2 border-b border-[var(--color-border-subtle)]">{children}</h1>
          },
          h2({ children }) {
            return <h2 className="text-xl font-bold mt-5 mb-3 pb-1 border-b border-[var(--color-border-subtle)]">{children}</h2>
          },
          h3({ children }) {
            return <h3 className="text-lg font-bold mt-4 mb-2">{children}</h3>
          },
          h4({ children }) {
            return <h4 className="text-base font-bold mt-3 mb-2">{children}</h4>
          },
          // 自定义列表渲染
          ul({ children }) {
            return <ul className="my-3 ml-6 list-disc space-y-1">{children}</ul>
          },
          ol({ children }) {
            return <ol className="my-3 ml-6 list-decimal space-y-1">{children}</ol>
          },
          // 自定义图片渲染
          img({ src, alt }) {
            return (
              <img
                src={src}
                alt={alt}
                className="max-w-full h-auto rounded-lg my-4"
              />
            )
          },
          // 自定义水平线渲染
          hr() {
            return <hr className="my-6 border-[var(--color-border-subtle)]" />
          },
        }}
      >
        {contentWithoutMermaid}
      </ReactMarkdown>
    </div>
  )
}
