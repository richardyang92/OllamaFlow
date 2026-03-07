/**
 * Agent 专用的轻量级 Markdown 渲染组件
 * 支持代码高亮、GFM 语法
 */

import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'

interface AgentMarkdownProps {
  content: string
  className?: string
}

export const AgentMarkdown = memo(function AgentMarkdown({
  content,
  className,
}: AgentMarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      components={{
        // 代码块
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '')
          const isInline = !match

          if (isInline) {
            return (
              <code
                className="px-1.5 py-0.5 bg-[var(--color-bg-input)] rounded text-xs font-mono text-blue-400"
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
        // 代码块容器
        pre({ children }) {
          return (
            <pre className="my-2 p-3 bg-[var(--color-bg-input)] rounded-lg border border-[var(--color-border-subtle)] overflow-x-auto text-xs">
              {children}
            </pre>
          )
        },
        // 段落
        p({ children }) {
          return <p className="mb-2 last:mb-0">{children}</p>
        },
        // 表格
        table({ children }) {
          return (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full border-collapse border border-[var(--color-border-subtle)] rounded-lg text-xs">
                {children}
              </table>
            </div>
          )
        },
        th({ children }) {
          return (
            <th className="border border-[var(--color-border-subtle)] px-2 py-1 bg-[var(--color-bg-input)] text-left font-medium">
              {children}
            </th>
          )
        },
        td({ children }) {
          return (
            <td className="border border-[var(--color-border-subtle)] px-2 py-1">
              {children}
            </td>
          )
        },
        // 引用
        blockquote({ children }) {
          return (
            <blockquote className="my-2 pl-3 border-l-2 border-blue-400 text-[var(--color-text-muted)] italic">
              {children}
            </blockquote>
          )
        },
        // 链接
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              {children}
            </a>
          )
        },
        // 标题
        h1({ children }) {
          return <h1 className="text-lg font-bold mt-3 mb-2">{children}</h1>
        },
        h2({ children }) {
          return <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>
        },
        h3({ children }) {
          return <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>
        },
        h4({ children }) {
          return <h4 className="text-sm font-semibold mt-2 mb-1">{children}</h4>
        },
        // 列表
        ul({ children }) {
          return <ul className="my-2 ml-4 list-disc space-y-0.5">{children}</ul>
        },
        ol({ children }) {
          return <ol className="my-2 ml-4 list-decimal space-y-0.5">{children}</ol>
        },
        li({ children }) {
          return <li className="text-sm">{children}</li>
        },
        // 水平线
        hr() {
          return <hr className="my-3 border-[var(--color-border-subtle)]" />
        },
        // 强调
        strong({ children }) {
          return <strong className="font-semibold">{children}</strong>
        },
        // 斜体
        em({ children }) {
          return <em className="italic">{children}</em>
        },
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  )
})

export default AgentMarkdown
