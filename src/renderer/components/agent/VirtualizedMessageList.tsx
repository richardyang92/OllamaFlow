/**
 * 虚拟化消息列表组件
 * 使用 react-window 2.x 实现虚拟滚动
 * 只渲染可见区域的消息，大幅减少 DOM 节点
 *
 * 性能优化：
 * 1. 使用单一 ResizeObserver 实例监听所有消息项
 * 2. 高度变化阈值检测，避免频繁更新
 * 3. 流式滚动节流优化
 */

import { useRef, useCallback, useEffect, useMemo, memo, useState } from 'react'
import { List } from 'react-window'
import type { AgentMessage } from '@/store/agent-store'
import AgentMessageBlock from './AgentMessageBlock'

interface VirtualizedMessageListProps {
  messages: AgentMessage[]
  isRunning: boolean
  onRetry: (messageId: string) => void
  onDelete: (messageId: string) => void
  onEdit: (messageId: string, newContent: string) => void
  streamingMessageId?: string | null
  containerHeight?: number
}

// Row props 类型
interface RowProps {
  messages: AgentMessage[]
  isRunning: boolean
  onRetry: (messageId: string) => void
  onDelete: (messageId: string) => void
  onEdit: (messageId: string, newContent: string) => void
}

// 单个消息项组件 - 不再创建独立 ResizeObserver
const MessageItem = memo(function MessageItem({
  message,
  isLast,
  isRunning,
  onRetry,
  onDelete,
  onEdit,
  itemRef,
}: {
  message: AgentMessage
  isLast: boolean
  isRunning: boolean
  onRetry: () => void
  onDelete: () => void
  onEdit: (newContent: string) => void
  itemRef: React.RefObject<HTMLDivElement>
}) {
  return (
    <div ref={itemRef} data-message-id={message.id} style={{ width: '100%' }}>
      <AgentMessageBlock
        message={message}
        isLast={isLast}
        isRunning={isRunning}
        onRetry={onRetry}
        onDelete={onDelete}
        onEdit={(newContent) => onEdit(newContent)}
      />
    </div>
  )
})

// 存储每个 row 的 ref
const rowRefsMap = new Map<string, React.RefObject<HTMLDivElement>>()

// Row 组件 - 使用 react-window 2.x 的 rowComponent API
function RowComponent({
  index,
  style,
  ariaAttributes,
  messages,
  isRunning,
  onRetry,
  onDelete,
  onEdit,
}: {
  ariaAttributes: {
    "aria-posinset": number
    "aria-setsize": number
    role: "listitem"
  }
  index: number
  style: React.CSSProperties
} & RowProps) {
  const message = messages[index]
  const isLast = index === messages.length - 1

  // 获取或创建该消息的 ref
  let itemRef = rowRefsMap.get(message.id)
  if (!itemRef) {
    itemRef = { current: null } as React.RefObject<HTMLDivElement>
    rowRefsMap.set(message.id, itemRef)
  }

  return (
    <div style={{ ...style, overflowX: 'hidden' }} {...ariaAttributes}>
      <MessageItem
        message={message}
        isLast={isLast}
        isRunning={isRunning}
        onRetry={() => onRetry(message.id)}
        onDelete={() => onDelete(message.id)}
        onEdit={(newContent) => onEdit(message.id, newContent)}
        itemRef={itemRef}
      />
    </div>
  )
}

export const VirtualizedMessageList = memo(function VirtualizedMessageList({
  messages,
  isRunning,
  onRetry,
  onDelete,
  onEdit,
  streamingMessageId,
  containerHeight: _containerHeightProp,
}: VirtualizedMessageListProps) {
  const listRef = useRef<{
    readonly element: HTMLDivElement | null
    scrollToRow: (config: {
      align?: "auto" | "center" | "end" | "smart" | "start"
      behavior?: "auto" | "instant" | "smooth"
      index: number
    }) => void
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const heightMapRef = useRef(new Map<string, number>())
  const [listHeight, setListHeight] = useState(600)
  const prevLengthRef = useRef(messages.length)

  // 单一 ResizeObserver 实例 - 监听所有消息项
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const observedElementsRef = useRef(new Map<Element, string>())

  // 创建并管理单一 ResizeObserver
  useEffect(() => {
    resizeObserverRef.current = new ResizeObserver((entries) => {
      let needsUpdate = false
      for (const entry of entries) {
        const messageId = observedElementsRef.current.get(entry.target)
        if (messageId) {
          const newHeight = entry.contentRect.height
          const currentHeight = heightMapRef.current.get(messageId)
          // 只有高度变化超过 10px 时才更新，避免频繁重排
          if (!currentHeight || Math.abs(currentHeight - newHeight) > 10) {
            heightMapRef.current.set(messageId, newHeight)
            needsUpdate = true
          }
        }
      }
      // 如果有高度变化，触发列表重新计算
      if (needsUpdate && listRef.current) {
        // 使用 requestAnimationFrame 批量更新
        requestAnimationFrame(() => {
          listRef.current?.scrollToRow({ index: messages.length - 1, align: 'end' })
        })
      }
    })

    return () => {
      resizeObserverRef.current?.disconnect()
      observedElementsRef.current.clear()
    }
  }, [messages.length])

  // 监听新的消息项
  useEffect(() => {
    const observer = resizeObserverRef.current
    if (!observer) return

    // 遍历所有 row refs，确保都被监听
    rowRefsMap.forEach((itemRef, messageId) => {
      if (itemRef.current && !observedElementsRef.current.has(itemRef.current)) {
        observedElementsRef.current.set(itemRef.current, messageId)
        observer.observe(itemRef.current)
      }
    })

    // 清理已删除消息的监听
    const currentIds = new Set(messages.map(m => m.id))
    observedElementsRef.current.forEach((messageId, element) => {
      if (!currentIds.has(messageId)) {
        observer.unobserve(element)
        observedElementsRef.current.delete(element)
        rowRefsMap.delete(messageId)
      }
    })
  }, [messages])

  // 获取项目高度的函数
  const getRowHeight = useCallback((index: number) => {
    const message = messages[index]
    if (!message) return 100 // 默认高度

    const storedHeight = heightMapRef.current.get(message.id)
    if (storedHeight) return storedHeight

    // 估算高度：基于内容长度和是否有步骤
    const baseHeight = 80
    const contentLength = (message.content?.length || 0) + (message.reasoningContent?.length || 0)
    const stepsCount = message.steps?.length || 0

    // 简单估算：每 100 字符增加 20px，每个步骤增加 60px
    const estimatedHeight = baseHeight + Math.floor(contentLength / 100) * 20 + stepsCount * 60
    return Math.min(estimatedHeight, 800) // 最大 800px
  }, [messages])

  // 流式时自动滚动到底部 - 节流优化
  useEffect(() => {
    if (streamingMessageId && messages.length > 0 && listRef.current) {
      // 使用 requestAnimationFrame 确保 DOM 更新后再滚动
      requestAnimationFrame(() => {
        listRef.current?.scrollToRow({
          index: messages.length - 1,
          align: 'end'
        })
      })
    }
  }, [streamingMessageId, messages.length])

  // 当消息数量增加时，滚动到新消息
  useEffect(() => {
    if (messages.length > prevLengthRef.current && listRef.current) {
      // 新消息添加，滚动到底部
      requestAnimationFrame(() => {
        listRef.current?.scrollToRow({
          index: messages.length - 1,
          align: 'end'
        })
      })
    }
    prevLengthRef.current = messages.length
  }, [messages.length])

  // 监听容器高度变化
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setListHeight(entry.contentRect.height)
      }
    })
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  // 准备 rowProps - 使用 useMemo 稳定引用
  const rowProps = useMemo<RowProps>(() => ({
    messages,
    isRunning,
    onRetry,
    onDelete,
    onEdit,
  }), [messages, isRunning, onRetry, onDelete, onEdit])

  // 消息为空时不渲染虚拟列表
  if (messages.length === 0) {
    return null
  }

  return (
    <div ref={containerRef} className="w-full h-full overflow-x-hidden">
      <List<RowProps>
        listRef={listRef}
        style={{ height: listHeight, width: '100%', overflowX: 'hidden' }}
        rowCount={messages.length}
        rowHeight={getRowHeight}
        rowProps={rowProps}
        rowComponent={RowComponent}
        overscanCount={3}
        className="scrollbar-thin"
      />
    </div>
  )
})
