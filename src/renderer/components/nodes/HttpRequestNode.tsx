import { memo } from 'react'
import { NodeProps } from '@xyflow/react'
import { Globe } from 'lucide-react'
import BaseNode from './BaseNode'
import { HttpRequestNodeData } from '@/types/node'

const methodColors: Record<string, string> = {
  GET: 'text-green-500',
  POST: 'text-blue-500',
  PUT: 'text-yellow-500',
  DELETE: 'text-red-500',
  PATCH: 'text-purple-500',
}

function HttpRequestNode(props: NodeProps<HttpRequestNodeData>) {
  const { data } = props

  const getDisplayUrl = () => {
    if (!data.url) return '(未设置)'
    try {
      const url = new URL(data.url)
      return url.host + url.pathname
    } catch {
      return data.url
    }
  }

  return (
    <BaseNode {...props} icon={<Globe className="w-4 h-4" />}>
      <div className="space-y-3 w-full">
        <div className="node-primary-badge network">
          <Globe className="w-4 h-4" />
          <span className={`font-mono font-semibold truncate text-sm ${methodColors[data.method] || ''}`}>
            {data.method}
          </span>
        </div>

        <div className="node-secondary-info">
          <div className="text-[var(--color-text-muted)]">
            {data.url ? (
              <span className="font-mono text-[10px] truncate block">
                {getDisplayUrl()}
              </span>
            ) : (
              <span className="text-[var(--color-text-subtle)]">无 URL</span>
            )}
          </div>
          <div className="flex justify-between text-[10px] mt-1.5">
            <span className="text-[var(--color-text-subtle)]">超时</span>
            <span className="text-[var(--color-text)]">{data.timeout / 1000}s</span>
          </div>
        </div>
      </div>
    </BaseNode>
  )
}

export default memo(HttpRequestNode)
