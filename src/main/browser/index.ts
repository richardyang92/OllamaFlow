/**
 * BrowserManager - Playwright-based browser automation for OllamaFlow
 * Provides headless browser control for ReAct Agent tools
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright-core'
import path from 'path'
import fs from 'fs/promises'
import type {
  BrowserInitOptions,
  BrowserSession,
  BrowserStatus,
  NavigateResult,
  ClickOptions,
  TypeOptions,
  ActionResult,
  ScreenshotOptions,
  ScreenshotResult,
  GetContentOptions,
  ContentResult,
  EvaluateResult,
  WaitOptions,
  TabInfo,
  ScrollOptions,
} from './types'

export class BrowserManager {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private session: BrowserSession | null = null
  private screenshotDir: string

  constructor(workspacePath: string) {
    this.screenshotDir = path.join(workspacePath, '.ollamaflow', 'screenshots')
  }

  /**
   * Initialize browser instance
   */
  async init(options: BrowserInitOptions = {}): Promise<BrowserSession> {
    // Clean up existing session
    if (this.browser) {
      await this.close()
    }

    const defaultOptions: BrowserInitOptions = {
      headless: true,
      viewport: { width: 1280, height: 720 },
      timeout: 30000,
      ...options,
    }

    try {
      this.browser = await chromium.launch({
        headless: defaultOptions.headless,
        timeout: defaultOptions.timeout,
      })

      this.context = await this.browser.newContext({
        viewport: defaultOptions.viewport,
        userAgent: defaultOptions.userAgent,
        locale: defaultOptions.locale,
      })

      this.page = await this.context.newPage()

      // Create screenshot directory
      await fs.mkdir(this.screenshotDir, { recursive: true })

      this.session = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        options: defaultOptions,
      }

      return this.session
    } catch (error) {
      // Clean up on failure
      await this.close()
      throw error
    }
  }

  /**
   * Close browser instance
   */
  async close(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {})
      this.page = null
    }
    if (this.context) {
      await this.context.close().catch(() => {})
      this.context = null
    }
    if (this.browser) {
      await this.browser.close().catch(() => {})
      this.browser = null
    }
    this.session = null
  }

  /**
   * Ensure browser is initialized
   */
  private ensureBrowser(): void {
    if (!this.page || !this.browser) {
      throw new Error('浏览器未初始化。请先调用 browser.init()')
    }
  }

  /**
   * Get current browser status
   */
  async getStatus(): Promise<BrowserStatus> {
    if (!this.browser || !this.page) {
      return {
        isConnected: false,
        currentPageUrl: null,
        pageTitle: null,
        tabs: [],
      }
    }

    const pages = this.context?.pages() || []
    const tabs: TabInfo[] = await Promise.all(
      pages.map(async (p, i) => ({
        id: String(i),
        url: p.url(),
        title: await p.title().catch(() => ''),
        isActive: p === this.page,
      }))
    )

    return {
      isConnected: this.browser.isConnected(),
      currentPageUrl: this.page.url(),
      pageTitle: await this.page.title().catch(() => ''),
      tabs,
    }
  }

  /**
   * Navigate to URL
   */
  async navigate(url: string): Promise<NavigateResult> {
    this.ensureBrowser()
    try {
      // Ensure URL has protocol
      let targetUrl = url
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        targetUrl = 'https://' + url
      }

      const response = await this.page!.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      const title = await this.page!.title()

      return {
        success: response?.ok() ?? false,
        url: this.page!.url(),
        title,
      }
    } catch (error) {
      return {
        success: false,
        url: '',
        title: '',
        error: `导航失败: ${(error as Error).message}`,
      }
    }
  }

  /**
   * Click element by selector
   */
  async click(selector: string, options: ClickOptions = {}): Promise<ActionResult> {
    this.ensureBrowser()
    try {
      await this.page!.click(selector, {
        button: options.button,
        clickCount: options.clickCount,
        delay: options.delay,
        timeout: options.timeout || 5000,
      })
      return { success: true, message: `已点击元素: ${selector}` }
    } catch (error) {
      return {
        success: false,
        message: '',
        error: `点击失败: ${(error as Error).message}`,
      }
    }
  }

  /**
   * Type text into element
   */
  async type(selector: string, text: string, options: TypeOptions = {}): Promise<ActionResult> {
    this.ensureBrowser()
    try {
      if (options.clear) {
        await this.page!.fill(selector, '')
      }
      await this.page!.type(selector, text, { delay: options.delay })
      return { success: true, message: `已在 ${selector} 中输入文本` }
    } catch (error) {
      return {
        success: false,
        message: '',
        error: `输入失败: ${(error as Error).message}`,
      }
    }
  }

  /**
   * Scroll page
   */
  async scroll(options: ScrollOptions): Promise<ActionResult> {
    this.ensureBrowser()
    try {
      const amount = options.amount || 300
      const scrollMap = {
        up: `window.scrollBy(0, -${amount})`,
        down: `window.scrollBy(0, ${amount})`,
        left: `window.scrollBy(-${amount}, 0)`,
        right: `window.scrollBy(${amount}, 0)`,
      }
      await this.page!.evaluate(scrollMap[options.direction])
      return {
        success: true,
        message: `已向${options.direction === 'up' ? '上' : options.direction === 'down' ? '下' : options.direction === 'left' ? '左' : '右'}滚动 ${amount} 像素`,
      }
    } catch (error) {
      return {
        success: false,
        message: '',
        error: `滚动失败: ${(error as Error).message}`,
      }
    }
  }

  /**
   * Take screenshot
   */
  async screenshot(options: ScreenshotOptions = {}): Promise<ScreenshotResult> {
    this.ensureBrowser()
    try {
      let buffer: Buffer

      if (options.selector) {
        const element = await this.page!.waitForSelector(options.selector, { timeout: 5000 })
        if (!element) {
          return {
            success: false,
            dataUrl: '',
            width: 0,
            height: 0,
            error: `未找到元素: ${options.selector}`,
          }
        }
        buffer = await element.screenshot({
          type: options.format || 'png',
        })
      } else {
        buffer = await this.page!.screenshot({
          fullPage: options.fullPage || false,
          type: options.format || 'png',
        })
      }

      const base64 = buffer.toString('base64')
      const mimeType = options.format === 'jpeg' ? 'image/jpeg' : 'image/png'

      // Get dimensions from page
      const dimensions = await this.page!.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
      }))

      return {
        success: true,
        dataUrl: `data:${mimeType};base64,${base64}`,
        width: options.fullPage ? 0 : dimensions.width,
        height: options.fullPage ? 0 : dimensions.height,
      }
    } catch (error) {
      return {
        success: false,
        dataUrl: '',
        width: 0,
        height: 0,
        error: `截图失败: ${(error as Error).message}`,
      }
    }
  }

  /**
   * Get page content
   */
  async getContent(options: GetContentOptions): Promise<ContentResult> {
    this.ensureBrowser()
    try {
      let content: string

      if (options.selector) {
        const element = await this.page!.waitForSelector(options.selector, { timeout: 5000 })
        if (!element) {
          return {
            success: false,
            content: '',
            format: options.format,
            length: 0,
            error: `未找到元素: ${options.selector}`,
          }
        }
        content =
          options.format === 'html' ? await element.innerHTML() : await element.innerText()
      } else {
        content = options.format === 'html' ? await this.page!.content() : await this.page!.innerText('body')
      }

      if (options.trim) {
        content = content.trim()
      }

      let truncated = false
      if (options.maxLength && content.length > options.maxLength) {
        content = content.slice(0, options.maxLength) + '\n...[内容已截断]'
        truncated = true
      }

      return {
        success: true,
        content,
        format: options.format,
        length: content.length,
        truncated,
      }
    } catch (error) {
      return {
        success: false,
        content: '',
        format: options.format,
        length: 0,
        error: `获取内容失败: ${(error as Error).message}`,
      }
    }
  }

  /**
   * Execute JavaScript in page
   */
  async evaluate(script: string): Promise<EvaluateResult> {
    this.ensureBrowser()
    try {
      const result = await this.page!.evaluate(script)
      return { success: true, result }
    } catch (error) {
      return {
        success: false,
        result: null,
        error: `JavaScript 执行失败: ${(error as Error).message}`,
      }
    }
  }

  /**
   * Wait for selector
   */
  async waitForSelector(selector: string, options: WaitOptions = {}): Promise<ActionResult> {
    this.ensureBrowser()
    try {
      await this.page!.waitForSelector(selector, {
        timeout: options.timeout || 5000,
        state: options.state || 'visible',
      })
      return { success: true, message: `元素已出现: ${selector}` }
    } catch (error) {
      return {
        success: false,
        message: '',
        error: `等待超时: ${(error as Error).message}`,
      }
    }
  }

  /**
   * Wait for timeout
   */
  async waitForTimeout(ms: number): Promise<void> {
    this.ensureBrowser()
    await this.page!.waitForTimeout(ms)
  }

  /**
   * Get all tabs
   */
  async getTabs(): Promise<TabInfo[]> {
    const status = await this.getStatus()
    return status.tabs
  }

  /**
   * Switch to tab by ID
   */
  async switchTab(tabId: string): Promise<ActionResult> {
    this.ensureBrowser()
    const pages = this.context!.pages()
    const index = parseInt(tabId, 10)
    if (index >= 0 && index < pages.length) {
      this.page = pages[index]
      // Bring page to front
      await this.page.bringToFront()
      return { success: true, message: `已切换到标签页 ${tabId}` }
    }
    return { success: false, message: '', error: `标签页 ${tabId} 不存在` }
  }

  /**
   * Create new tab
   */
  async newTab(url?: string): Promise<TabInfo> {
    this.ensureBrowser()
    const newPage = await this.context!.newPage()
    if (url) {
      await newPage.goto(url).catch(() => {})
    }
    this.page = newPage
    const index = this.context!.pages().length - 1
    return {
      id: String(index),
      url: newPage.url(),
      title: await newPage.title().catch(() => ''),
      isActive: true,
    }
  }

  /**
   * Close tab by ID
   */
  async closeTab(tabId: string): Promise<ActionResult> {
    this.ensureBrowser()
    const pages = this.context!.pages()
    const index = parseInt(tabId, 10)
    if (index >= 0 && index < pages.length && pages.length > 1) {
      await pages[index].close()
      if (this.page === pages[index]) {
        this.page = pages[0]
      }
      return { success: true, message: `已关闭标签页 ${tabId}` }
    }
    return { success: false, message: '', error: '无法关闭唯一的标签页或标签页不存在' }
  }

  /**
   * Go back in history
   */
  async goBack(): Promise<ActionResult> {
    this.ensureBrowser()
    try {
      await this.page!.goBack({ waitUntil: 'domcontentloaded' })
      return { success: true, message: '已后退到上一页' }
    } catch (error) {
      return { success: false, message: '', error: `后退失败: ${(error as Error).message}` }
    }
  }

  /**
   * Go forward in history
   */
  async goForward(): Promise<ActionResult> {
    this.ensureBrowser()
    try {
      await this.page!.goForward({ waitUntil: 'domcontentloaded' })
      return { success: true, message: '已前进到下一页' }
    } catch (error) {
      return { success: false, message: '', error: `前进失败: ${(error as Error).message}` }
    }
  }
}

// Singleton instances per workspace
const browserManagers = new Map<string, BrowserManager>()

/**
 * Get or create BrowserManager for a workspace
 */
export function getBrowserManager(workspacePath: string): BrowserManager {
  if (!browserManagers.has(workspacePath)) {
    browserManagers.set(workspacePath, new BrowserManager(workspacePath))
  }
  return browserManagers.get(workspacePath)!
}

/**
 * Close and remove BrowserManager for a workspace
 */
export async function closeBrowserManager(workspacePath: string): Promise<void> {
  const manager = browserManagers.get(workspacePath)
  if (manager) {
    await manager.close()
    browserManagers.delete(workspacePath)
  }
}
