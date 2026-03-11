/**
 * Web Content Parser for Renderer Process
 * Wraps IPC calls to main process web parser
 */

export interface ParsedWebContent {
  title: string
  mainContent: string
  textContent: string
  links: Array<{ text: string; href: string }>
  error?: string
}

export interface WebParserOptions {
  maxContentLength?: number
  includeLinks?: boolean
  outputFormat?: 'markdown' | 'text'
  timeout?: number
}

/**
 * Parse HTML content using main process jsdom parser
 */
export async function parseHtmlContent(
  html: string,
  baseUrl?: string,
  options?: WebParserOptions
): Promise<ParsedWebContent> {
  return window.electronAPI.webParser.parseHtml(html, baseUrl, options)
}

/**
 * Fetch URL and parse content
 */
export async function fetchAndParseUrl(
  url: string,
  options?: WebParserOptions
): Promise<ParsedWebContent> {
  return window.electronAPI.webParser.fetchAndParse(url, options)
}

/**
 * Check if content is HTML
 */
export async function isHtmlContent(content: string): Promise<boolean> {
  return window.electronAPI.webParser.isHtml(content)
}

/**
 * Format parsed content for LLM context
 */
export function formatParsedContentForLLM(parsed: ParsedWebContent, maxLength: number = 5000): string {
  if (parsed.error) {
    return `[解析失败: ${parsed.error}]`
  }

  const parts: string[] = []

  // Add title
  if (parsed.title) {
    parts.push(`# ${parsed.title}\n`)
  }

  // Add main content (truncated if needed)
  let content = parsed.mainContent || parsed.textContent
  if (content.length > maxLength) {
    content = content.slice(0, maxLength) + '\n...[内容已截断]'
  }
  parts.push(content)

  // Add links summary if available
  if (parsed.links && parsed.links.length > 0) {
    parts.push('\n\n## 相关链接')
    parsed.links.slice(0, 10).forEach(link => {
      parts.push(`- [${link.text}](${link.href})`)
    })
    if (parsed.links.length > 10) {
      parts.push(`- ...还有 ${parsed.links.length - 10} 个链接`)
    }
  }

  return parts.join('\n')
}
