import { useMemo } from 'react'
import DOMPurify from 'dompurify'

interface HtmlRendererProps {
  content: string
}

export default function HtmlRenderer({ content }: HtmlRendererProps) {
  const safeHtml = useMemo(() => {
    // 使用 DOMPurify 净化 HTML
    const sanitized = DOMPurify.sanitize(content, {
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'meta', 'link', 'style'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
      ALLOW_DATA_ATTR: false,
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    })

    // 构建完整的 HTML 文档，注入暗色主题样式
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            :root {
              color-scheme: dark;
            }
            * {
              box-sizing: border-box;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: transparent;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              color: rgba(241, 245, 249, 0.9);
              padding: 16px;
            }
            a {
              color: #60a5fa;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
            img {
              max-width: 100%;
              height: auto;
              border-radius: 8px;
            }
            h1, h2, h3, h4, h5, h6 {
              margin-top: 1em;
              margin-bottom: 0.5em;
              font-weight: 600;
            }
            h1 { font-size: 2em; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.3em; }
            h2 { font-size: 1.5em; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.3em; }
            h3 { font-size: 1.25em; }
            h4 { font-size: 1em; }
            p { margin: 1em 0; }
            ul, ol { margin: 1em 0; padding-left: 2em; }
            li { margin: 0.25em 0; }
            blockquote {
              margin: 1em 0;
              padding-left: 1em;
              border-left: 4px solid #60a5fa;
              color: rgba(161, 161, 170, 0.9);
            }
            pre, code {
              font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
            }
            code {
              background: rgba(255,255,255,0.05);
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 0.9em;
            }
            pre {
              background: rgba(255,255,255,0.05);
              padding: 12px 16px;
              border-radius: 8px;
              overflow-x: auto;
              border: 1px solid rgba(255,255,255,0.06);
            }
            pre code {
              background: transparent;
              padding: 0;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 1em 0;
            }
            th, td {
              border: 1px solid rgba(255,255,255,0.1);
              padding: 8px 12px;
              text-align: left;
            }
            th {
              background: rgba(255,255,255,0.05);
              font-weight: 600;
            }
            hr {
              border: none;
              border-top: 1px solid rgba(255,255,255,0.1);
              margin: 2em 0;
            }
          </style>
        </head>
        <body>${sanitized}</body>
      </html>
    `
  }, [content])

  return (
    <iframe
      srcDoc={safeHtml}
      sandbox="allow-same-origin"
      className="w-full h-[60vh] rounded-lg border border-[var(--color-border-subtle)] bg-transparent"
      title="HTML Preview"
    />
  )
}
