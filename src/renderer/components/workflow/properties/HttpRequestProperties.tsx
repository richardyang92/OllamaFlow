import { useState } from 'react'
import type { WorkflowNode, HttpRequestNodeData } from '@/types/node'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<HttpRequestNodeData>) => void
}

export default function HttpRequestProperties({ node, updateNodeData }: Props) {
  const data = node.data as HttpRequestNodeData
  const [headerKey, setHeaderKey] = useState('')
  const [headerValue, setHeaderValue] = useState('')

  const addHeader = () => {
    if (headerKey.trim()) {
      const newHeaders = { ...data.headers, [headerKey.trim()]: headerValue }
      updateNodeData(node.id, { headers: newHeaders })
      setHeaderKey('')
      setHeaderValue('')
    }
  }

  const removeHeader = (key: string) => {
    const { [key]: _, ...rest } = data.headers
    updateNodeData(node.id, { headers: rest })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
          请求方法
        </label>
        <select
          value={data.method}
          onChange={(e) => updateNodeData(node.id, { method: e.target.value as HttpRequestNodeData['method'] })}
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-border)]"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
          URL
          <span className="text-[var(--color-text-muted)] ml-1">(支持 {`{{变量}}`})</span>
        </label>
        <input
          type="text"
          value={data.url}
          onChange={(e) => updateNodeData(node.id, { url: e.target.value })}
          placeholder="https://api.example.com/endpoint"
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] font-mono"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2">
          请求头
        </label>
        <div className="space-y-2">
          {Object.entries(data.headers || {}).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="flex-1 text-xs font-mono bg-[var(--color-bg-input)] px-2 py-1 rounded border border-[var(--color-border-subtle)] truncate">
                {key}: {value}
              </span>
              <button
                onClick={() => removeHeader(key)}
                className="text-[var(--color-text-muted)] hover:text-red-500 text-sm"
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={headerKey}
              onChange={(e) => setHeaderKey(e.target.value)}
              placeholder="Header-Name"
              className="flex-1 px-2 py-1 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)]"
            />
            <input
              type="text"
              value={headerValue}
              onChange={(e) => setHeaderValue(e.target.value)}
              placeholder="Value"
              className="flex-1 px-2 py-1 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)]"
            />
            <button
              onClick={addHeader}
              className="px-2 py-1 bg-[var(--color-bg-hover)] border border-[var(--color-border-subtle)] rounded text-xs hover:bg-[var(--color-bg-active)]"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {(data.method === 'POST' || data.method === 'PUT' || data.method === 'PATCH') && (
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
            Body 类型
          </label>
          <select
            value={data.bodyType}
            onChange={(e) => updateNodeData(node.id, { bodyType: e.target.value as HttpRequestNodeData['bodyType'] })}
            className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-border)]"
          >
            <option value="none">无</option>
            <option value="json">JSON</option>
            <option value="text">Text</option>
            <option value="form">Form Data</option>
          </select>
        </div>
      )}

      {data.bodyType !== 'none' && (data.method === 'POST' || data.method === 'PUT' || data.method === 'PATCH') && (
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
            Body 内容
            <span className="text-[var(--color-text-muted)] ml-1">(支持 {`{{变量}}`})</span>
          </label>
          <textarea
            value={data.body}
            onChange={(e) => updateNodeData(node.id, { body: e.target.value })}
            rows={4}
            placeholder={data.bodyType === 'json' ? '{"key": "value"}' : 'Request body'}
            className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border)] resize-none font-mono"
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
          超时时间（秒）
        </label>
        <input
          type="number"
          min="1"
          max="300"
          value={data.timeout / 1000}
          onChange={(e) => updateNodeData(node.id, { timeout: parseInt(e.target.value) * 1000 })}
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-border)]"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
          响应类型
        </label>
        <select
          value={data.responseType}
          onChange={(e) => updateNodeData(node.id, { responseType: e.target.value as 'json' | 'text' })}
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-border)]"
        >
          <option value="json">JSON (自动解析)</option>
          <option value="text">Text (原始文本)</option>
        </select>
      </div>

      <div className="bg-[var(--color-bg-input)] rounded-lg p-3 text-xs text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
        <div className="font-medium text-[var(--color-text)] mb-2">输出变量：</div>
        <div className="space-y-1">
          <div>• <code className="text-[var(--color-text)]">response</code>: 响应数据 (JSON 或文本)</div>
          <div>• <code className="text-[var(--color-text)]">status</code>: HTTP 状态码</div>
        </div>
        <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)]">
          <div className="text-[var(--color-text-muted)]">使用方式: <code className="text-[var(--color-text)]">{`{{httpRequest.response}}`}</code></div>
        </div>
      </div>
    </div>
  )
}
