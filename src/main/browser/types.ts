/**
 * Browser Automation Types
 * Types for browser automation tool system using Playwright
 */

// Browser initialization options
export interface BrowserInitOptions {
  headless?: boolean
  viewport?: {
    width: number
    height: number
  }
  userAgent?: string
  locale?: string
  timeout?: number
}

// Browser session info
export interface BrowserSession {
  id: string
  createdAt: string
  options: BrowserInitOptions
}

// Browser status
export interface BrowserStatus {
  isConnected: boolean
  currentPageUrl: string | null
  pageTitle: string | null
  tabs: TabInfo[]
}

// Navigation result
export interface NavigateResult {
  success: boolean
  url: string
  title: string
  error?: string
}

// Click options
export interface ClickOptions {
  button?: 'left' | 'right' | 'middle'
  clickCount?: number
  delay?: number
  timeout?: number
}

// Type options
export interface TypeOptions {
  delay?: number
  clear?: boolean
}

// Generic action result
export interface ActionResult {
  success: boolean
  message: string
  error?: string
}

// Screenshot options
export interface ScreenshotOptions {
  fullPage?: boolean
  selector?: string
  format?: 'png' | 'jpeg'
}

// Screenshot result
export interface ScreenshotResult {
  success: boolean
  dataUrl: string
  width: number
  height: number
  error?: string
}

// Get content options
export interface GetContentOptions {
  selector?: string
  format: 'text' | 'html'
  trim?: boolean
  maxLength?: number
}

// Content result
export interface ContentResult {
  success: boolean
  content: string
  format: 'text' | 'html'
  length: number
  truncated?: boolean
  error?: string
}

// Evaluate result
export interface EvaluateResult {
  success: boolean
  result: unknown
  error?: string
}

// Wait options
export interface WaitOptions {
  timeout?: number
  state?: 'visible' | 'hidden' | 'attached' | 'detached'
}

// Tab info
export interface TabInfo {
  id: string
  url: string
  title: string
  isActive: boolean
}

// Scroll options
export interface ScrollOptions {
  direction: 'up' | 'down' | 'left' | 'right'
  amount?: number
}
