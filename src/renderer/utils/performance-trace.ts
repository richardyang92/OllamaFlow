/**
 * 性能追踪工具
 * 用于捕获和保存 Chrome DevTools 性能追踪数据
 */

interface TraceEvent {
  name: string
  cat: string
  ph: string
  ts: number
  pid: number
  tid: number
  args?: Record<string, unknown>
  dur?: number
}

interface PerformanceTraceResult {
  success: boolean
  filePath?: string
  error?: string
  canceled?: boolean
}

/**
 * 开始性能追踪
 */
export async function startPerformanceTrace(): Promise<void> {
  if (!window.performance || !('mark' in window.performance)) {
    console.warn('[Trace] Performance API not available')
    return
  }

  console.log('[Trace] Performance trace started')
  performance.mark('trace-start')
}

/**
 * 结束性能追踪并保存
 */
export async function stopAndSaveTrace(defaultPath?: string): Promise<PerformanceTraceResult> {
  if (!window.performance) {
    return { success: false, error: 'Performance API not available' }
  }

  try {
    // 获取 performance entries
    const entries = performance.getEntriesByType('measure')
    const marks = performance.getEntriesByType('mark')

    // 转换为 Chrome Trace Event Format
    const traceEvents: TraceEvent[] = []

    // 添加进程信息
    traceEvents.push({
      name: 'process_name',
      cat: '__metadata',
      ph: 'M',
      ts: 0,
      pid: 1,
      tid: 0,
      args: { name: 'Renderer' }
    })

    // 添加 marks
    marks.forEach((mark) => {
      traceEvents.push({
        name: mark.name,
        cat: 'devtools.timeline',
        ph: 'R', // Record event
        ts: Math.round(mark.startTime * 1000), // 转换为微秒
        pid: 1,
        tid: 0,
        args: { data: { frame: 'main' } }
      })
    })

    // 添加 measures
    entries.forEach((measure) => {
      traceEvents.push({
        name: measure.name,
        cat: 'devtools.timeline',
        ph: 'B', // Begin
        ts: Math.round(measure.startTime * 1000),
        pid: 1,
        tid: 0,
        args: { data: { frame: 'main' } }
      })
      traceEvents.push({
        name: measure.name,
        cat: 'devtools.timeline',
        ph: 'E', // End
        ts: Math.round((measure.startTime + measure.duration) * 1000),
        pid: 1,
        tid: 0,
        dur: Math.round(measure.duration * 1000),
        args: { data: { frame: 'main' } }
      })
    })

    // 清理
    performance.clearMarks()
    performance.clearMeasures()

    const traceData = JSON.stringify({
      traceEvents,
      metadata: {
        'clock-domain': 'TRACE_CLOCK_MONOTONIC',
        'beType': 'REALTIME',
        product: 'OllamaFlow',
        version: '1.0.0'
      }
    }, null, 2)

    // 保存到文件
    const result = await window.electronAPI.trace.save(traceData, defaultPath)

    if (result.success) {
      console.log(`[Trace] Trace saved to: ${result.filePath}`)
    } else if (!result.canceled) {
      console.error('[Trace] Failed to save trace:', result.error)
    }

    return result
  } catch (error) {
    console.error('[Trace] Error capturing trace:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * 使用 Profiler API 捕获更详细的追踪（如果可用）
 * 注意：这需要用户在 DevTools 中手动操作
 */
export async function captureDetailedTrace(): Promise<void> {
  console.log(`
========================================
性能追踪使用说明
========================================

由于浏览器安全限制，完整的性能追踪需要手动操作：

方法1: 使用 Chrome DevTools
1. 打开 DevTools (Cmd+Option+I)
2. 切换到 Performance 面板
3. 点击录制按钮（圆点图标）
4. 执行你要分析的操作
5. 停止录制
6. 右键点击时间线 -> Save trace
7. 使用弹出的保存对话框保存文件

方法2: 使用控制台命令
1. 在控制台运行: window.__startTrace__()
2. 执行操作
3. 运行: window.__stopAndSaveTrace__()

方法3: 使用 console.time/timeEnd
1. console.time('my-operation')
2. 执行操作
3. console.timeEnd('my-operation')

========================================
`)
}

// 在 window 上暴露简化 API
declare global {
  interface Window {
    __startTrace__?: () => void
    __stopAndSaveTrace__?: (defaultPath?: string) => Promise<PerformanceTraceResult>
  }
}

// 注册全局 API
if (typeof window !== 'undefined') {
  window.__startTrace__ = startPerformanceTrace
  window.__stopAndSaveTrace__ = stopAndSaveTrace
  console.log('[Trace] Performance trace API registered. Use __startTrace__() and __stopAndSaveTrace__() in console.')
}

export default {
  startPerformanceTrace,
  stopAndSaveTrace,
  captureDetailedTrace
}
