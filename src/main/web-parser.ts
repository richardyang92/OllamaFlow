/**
 * Web Content Parser for Main Process
 * Uses linkedom to parse HTML and extract main content (lightweight alternative to jsdom)
 */

import { parseHTML } from 'linkedom'

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
}

// Elements to remove (navigation, ads, etc.)
const REMOVE_SELECTORS = [
  'nav', 'header', 'footer', 'aside',
  '.nav', '.navigation', '.menu', '.sidebar',
  '.ad', '.ads', '.advertisement', '.banner',
  '.social', '.share', '.sharing',
  '.comment', '.comments', '#comments',
  '.related', '.recommended', '.suggestions',
  'script', 'style', 'noscript', 'iframe',
  '.cookie', '.gdpr', '.privacy',
  '.popup', '.modal', '.overlay',
]

// Main content selectors (priority order)
const MAIN_CONTENT_SELECTORS = [
  'article',
  '[role="main"]',
  'main',
  '.post-content',
  '.article-content',
  '.entry-content',
  '.content',
  '#content',
  '.post',
  '.article',
  '.body',
  'body',
]

/**
 * Parse HTML content and extract main content
 */
export function parseHtmlContent(
  html: string,
  _baseUrl?: string,
  options: WebParserOptions = {}
): ParsedWebContent {
  const {
    maxContentLength = 8000,
    includeLinks = true,
    outputFormat = 'markdown'
  } = options

  try {
    // Create DOM using linkedom (lightweight alternative to jsdom)
    const { document } = parseHTML(html)
    const doc = document

    // Extract title
    const title = doc.querySelector('title')?.textContent?.trim() ||
                  doc.querySelector('h1')?.textContent?.trim() || ''

    // Remove unwanted elements
    for (const selector of REMOVE_SELECTORS) {
      const elements = doc.querySelectorAll(selector)
      elements.forEach(el => el.remove())
    }

    // Find main content container
    let mainContainer: Element | null = null
    for (const selector of MAIN_CONTENT_SELECTORS) {
      mainContainer = doc.querySelector(selector)
      if (mainContainer) break
    }

    if (!mainContainer) {
      mainContainer = doc.body
    }

    // Extract links if requested
    const links: Array<{ text: string; href: string }> = []
    if (includeLinks && mainContainer) {
      const linkElements = mainContainer.querySelectorAll('a[href]')
      linkElements.forEach(link => {
        const text = link.textContent?.trim() || ''
        const href = link.getAttribute('href') || ''
        if (text && href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          links.push({ text, href })
        }
      })
    }

    // Convert to markdown or text
    let mainContent = ''
    if (outputFormat === 'markdown' && mainContainer) {
      mainContent = elementToMarkdown(mainContainer)
    } else if (mainContainer) {
      mainContent = mainContainer.textContent?.trim() || ''
    }

    // Get plain text content
    const textContent = mainContainer?.textContent?.trim() || ''

    // Truncate if too long
    if (mainContent.length > maxContentLength) {
      mainContent = mainContent.slice(0, maxContentLength) + '\n...[内容已截断]'
    }

    return {
      title,
      mainContent,
      textContent,
      links: links.slice(0, 20), // Limit links
    }
  } catch (error) {
    return {
      title: '',
      mainContent: '',
      textContent: '',
      links: [],
      error: `解析失败: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Convert DOM element to Markdown
 */
function elementToMarkdown(element: Element): string {
  const parts: string[] = []

  function processNode(node: Node, depth: number = 0): void {
    if (node.nodeType === 3) { // Text node
      const text = node.textContent?.trim()
      if (text) {
        parts.push(text)
      }
    } else if (node.nodeType === 1) { // Element node
      const el = node as Element
      const tagName = el.tagName.toLowerCase()

      switch (tagName) {
        case 'h1':
          parts.push('\n# ' + (el.textContent?.trim() || '') + '\n')
          break
        case 'h2':
          parts.push('\n## ' + (el.textContent?.trim() || '') + '\n')
          break
        case 'h3':
          parts.push('\n### ' + (el.textContent?.trim() || '') + '\n')
          break
        case 'h4':
          parts.push('\n#### ' + (el.textContent?.trim() || '') + '\n')
          break
        case 'h5':
          parts.push('\n##### ' + (el.textContent?.trim() || '') + '\n')
          break
        case 'h6':
          parts.push('\n###### ' + (el.textContent?.trim() || '') + '\n')
          break
        case 'p':
          parts.push('\n' + (el.textContent?.trim() || '') + '\n')
          break
        case 'br':
          parts.push('\n')
          break
        case 'hr':
          parts.push('\n---\n')
          break
        case 'ul':
        case 'ol':
          parts.push('\n')
          el.childNodes.forEach(child => processNode(child, depth + 1))
          parts.push('\n')
          break
        case 'li':
          parts.push('- ' + (el.textContent?.trim() || '') + '\n')
          break
        case 'blockquote':
          const lines = (el.textContent?.trim() || '').split('\n')
          lines.forEach(line => parts.push('> ' + line))
          parts.push('\n')
          break
        case 'code':
          if (el.parentElement?.tagName.toLowerCase() === 'pre') {
            parts.push('\n```\n' + (el.textContent || '') + '\n```\n')
          } else {
            parts.push('`' + (el.textContent || '') + '`')
          }
          break
        case 'pre':
          if (el.querySelector('code')) {
            // Will be handled by code case
            el.childNodes.forEach(child => processNode(child, depth + 1))
          } else {
            parts.push('\n```\n' + (el.textContent?.trim() || '') + '\n```\n')
          }
          break
        case 'a':
          const href = el.getAttribute('href')
          const text = el.textContent?.trim() || ''
          if (href && text) {
            parts.push(`[${text}](${href})`)
          } else {
            parts.push(text)
          }
          break
        case 'strong':
        case 'b':
          parts.push('**' + (el.textContent?.trim() || '') + '**')
          break
        case 'em':
        case 'i':
          parts.push('*' + (el.textContent?.trim() || '') + '*')
          break
        case 'img':
          const alt = el.getAttribute('alt') || ''
          const src = el.getAttribute('src') || ''
          parts.push(`![${alt}](${src})`)
          break
        case 'table':
          parts.push('\n')
          el.childNodes.forEach(child => processNode(child, depth + 1))
          parts.push('\n')
          break
        case 'tr':
          const cells = el.querySelectorAll('td, th')
          if (cells.length > 0) {
            parts.push('| ' + Array.from(cells).map(c => c.textContent?.trim() || '').join(' | ') + ' |\n')
          }
          break
        case 'div':
        case 'section':
        case 'article':
          parts.push('\n')
          el.childNodes.forEach(child => processNode(child, depth + 1))
          break
        default:
          el.childNodes.forEach(child => processNode(child, depth))
      }
    }
  }

  element.childNodes.forEach(child => processNode(child))

  // Clean up extra whitespace
  let result = parts.join('')
    .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive newlines
    .replace(/[ \t]+/g, ' ')     // Collapse spaces
    .trim()

  return result
}

/**
 * Detect if content is HTML
 */
export function isHtmlContent(content: string): boolean {
  const trimmed = content.trim().toLowerCase()
  return trimmed.startsWith('<!doctype') ||
         trimmed.startsWith('<html') ||
         trimmed.startsWith('<head') ||
         (trimmed.includes('<body') && trimmed.includes('</body>')) ||
         (trimmed.includes('<div') && trimmed.includes('</div>'))
}
