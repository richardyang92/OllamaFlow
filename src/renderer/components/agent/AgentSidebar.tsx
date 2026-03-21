import { useState, useMemo } from 'react'
import { Plus, Search, Pencil, Trash2, MessageSquare } from 'lucide-react'
import { useAgentStore, type ConversationMeta } from '@/store/agent-store'
import { cn } from '@/lib/utils'

// 时间分组类型
interface GroupedConversations {
  today: ConversationMeta[]
  yesterday: ConversationMeta[]
  thisWeek: ConversationMeta[]
  older: ConversationMeta[]
}

// 按时间分组
function groupConversationsByTime(conversations: ConversationMeta[]): GroupedConversations {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const today = new Date(new Date().setHours(0, 0, 0, 0)).getTime()
  const yesterday = today - day
  const weekAgo = now - 7 * day

  return {
    today: conversations.filter((c) => c.updatedAt >= today),
    yesterday: conversations.filter((c) => c.updatedAt >= yesterday && c.updatedAt < today),
    thisWeek: conversations.filter((c) => c.updatedAt >= weekAgo && c.updatedAt < yesterday),
    older: conversations.filter((c) => c.updatedAt < weekAgo),
  }
}

// 格式化时间
function formatTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const day = 24 * 60 * 60 * 1000

  if (diff < day) {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } else if (diff < 7 * day) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return days[new Date(timestamp).getDay()]
  } else {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    })
  }
}

// 单个对话项组件
interface ConversationItemProps {
  conversation: ConversationMeta
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (newTitle: string) => void
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: ConversationItemProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(conversation.title)

  const handleRename = () => {
    if (editTitle.trim() && editTitle !== conversation.title) {
      onRename(editTitle)
    }
    setIsEditing(false)
  }

  return (
      <div
      className={cn(
        'group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
        isActive
          ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
          : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text)]',
        'hover:bg-[var(--color-bg-hover)]'
      )}
      onClick={() => !isEditing && onSelect()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-60" />

      {isEditing ? (
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename()
            if (e.key === 'Escape') {
              setEditTitle(conversation.title)
              setIsEditing(false)
            }
          }}
          className="flex-1 bg-transparent border-none outline-none text-sm"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <span className="flex-1 text-sm truncate">{conversation.title}</span>
          <span className="text-xs text-[var(--color-text-muted)] opacity-60">
            {formatTime(conversation.updatedAt)}
          </span>
        </>
      )}

      {/* 操作按钮 */}
      {isHovered && !isEditing && (
        <div className="flex items-center gap-1 absolute right-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsEditing(true)
            }}
            className="p-1 hover:bg-[var(--color-bg-active)] rounded transition-colors cursor-pointer"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}

// 分组标题组件
interface GroupHeaderProps {
  title: string
  count: number
}

function GroupHeader({ title, count }: GroupHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 text-xs font-medium text-[var(--color-text-muted)]">
      <span>{title}</span>
      <span className="opacity-60">{count}</span>
    </div>
  )
}

// 主侧边栏组件
export default function AgentSidebar() {
  const {
    conversationHistory,
    searchQuery,
    createConversation,
    switchConversation,
    deleteConversation,
    renameConversation,
    setSearchQuery,
  } = useAgentStore()

  // 过滤对话
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) {
      return conversationHistory.conversations
    }
    const query = searchQuery.toLowerCase()
    return conversationHistory.conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.preview?.toLowerCase().includes(query)
    )
  }, [conversationHistory.conversations, searchQuery])

  // 分组
  const grouped = useMemo(
    () => groupConversationsByTime(filteredConversations),
    [filteredConversations]
  )

  const handleNewChat = () => {
    createConversation()
  }

  const handleSelect = (id: string) => {
    switchConversation(id)
  }

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个对话吗？')) {
      deleteConversation(id)
    }
  }

  const handleRename = (id: string, title: string) => {
    renameConversation(id, title)
  }

  return (
    <div className="h-full flex flex-col glass-panel border-r border-[var(--color-border-subtle)]">
      {/* 顶部：新建按钮 */}
      <div className="p-3">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500/20 text-blue-700 dark:text-blue-400 hover:bg-blue-500/30 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">新对话</span>
        </button>
      </div>

      {/* 搜索框 */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索对话..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors"
          />
        </div>
      </div>

      {/* 对话列表 */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[var(--color-text-muted)]">
            <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">
              {searchQuery ? '没有找到匹配的对话' : '暂无对话记录'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* 今天 */}
            {grouped.today.length > 0 && (
              <div>
                <GroupHeader title="今天" count={grouped.today.length} />
                {grouped.today.map((c) => (
                  <ConversationItem
                    key={c.id}
                    conversation={c}
                    isActive={c.id === conversationHistory.currentConversationId}
                    onSelect={() => handleSelect(c.id)}
                    onDelete={() => handleDelete(c.id)}
                    onRename={(title) => handleRename(c.id, title)}
                  />
                ))}
              </div>
            )}

            {/* 昨天 */}
            {grouped.yesterday.length > 0 && (
              <div>
                <GroupHeader title="昨天" count={grouped.yesterday.length} />
                {grouped.yesterday.map((c) => (
                  <ConversationItem
                    key={c.id}
                    conversation={c}
                    isActive={c.id === conversationHistory.currentConversationId}
                    onSelect={() => handleSelect(c.id)}
                    onDelete={() => handleDelete(c.id)}
                    onRename={(title) => handleRename(c.id, title)}
                  />
                ))}
              </div>
            )}

            {/* 过去7天 */}
            {grouped.thisWeek.length > 0 && (
              <div>
                <GroupHeader title="过去7天" count={grouped.thisWeek.length} />
                {grouped.thisWeek.map((c) => (
                  <ConversationItem
                    key={c.id}
                    conversation={c}
                    isActive={c.id === conversationHistory.currentConversationId}
                    onSelect={() => handleSelect(c.id)}
                    onDelete={() => handleDelete(c.id)}
                    onRename={(title) => handleRename(c.id, title)}
                  />
                ))}
              </div>
            )}

            {/* 更早 */}
            {grouped.older.length > 0 && (
              <div>
                <GroupHeader title="更早" count={grouped.older.length} />
                {grouped.older.map((c) => (
                  <ConversationItem
                    key={c.id}
                    conversation={c}
                    isActive={c.id === conversationHistory.currentConversationId}
                    onSelect={() => handleSelect(c.id)}
                    onDelete={() => handleDelete(c.id)}
                    onRename={(title) => handleRename(c.id, title)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
