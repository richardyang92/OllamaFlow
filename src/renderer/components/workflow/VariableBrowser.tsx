import { useState } from 'react'
import { Copy, Check, ChevronDown, ChevronRight, Variable, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { useWorkflowStore } from '@/store/workflow-store'
import { cn } from '@/lib/utils'
import type { NodeType } from '@/types/node'

// Node type display names in Chinese
const nodeTypeNames: Partial<Record<NodeType, string>> = {
  input: '输入',
  output: '输出',
  ollamaChat: 'Ollama 对话',
  reactAgent: 'ReAct Agent',
  plan: '计划',
  if: '条件',
  loop: '循环',
  smartRouter: '智能路由',
  queue: '队列',
  splitter: '分流器',
  join: '合并',
  delay: '延迟',
  set: '变量',
  json: 'JSON',
  readFile: '读取文件',
  writeFile: '写入文件',
  executeCommand: '执行命令',
  httpRequest: 'HTTP 请求',
  image: '图片',
}

// Node type colors
const nodeTypeColors: Partial<Record<NodeType, string>> = {
  input: 'text-cyan-400',
  output: 'text-teal-400',
  ollamaChat: 'text-purple-400',
  reactAgent: 'text-purple-400',
  plan: 'text-purple-400',
  if: 'text-blue-400',
  loop: 'text-blue-400',
  smartRouter: 'text-blue-400',
  queue: 'text-emerald-400',
  splitter: 'text-amber-400',
  join: 'text-emerald-400',
  delay: 'text-zinc-400',
  set: 'text-yellow-400',
  json: 'text-zinc-400',
  readFile: 'text-orange-400',
  writeFile: 'text-orange-400',
  executeCommand: 'text-red-400',
  httpRequest: 'text-indigo-400',
  image: 'text-pink-400',
}

interface PortInfo {
  id: string
  label?: string
  dataType?: string
}

export default function VariableBrowser() {
  const { nodes } = useWorkflowStore()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  const toggleNodeExpand = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  const copyVariable = async (varName: string, id: string) => {
    await navigator.clipboard.writeText(`{{${varName}}}`)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Get input ports for a node
  const getNodeInputs = (node: any): PortInfo[] => {
    if (node.data?.inputs && Array.isArray(node.data.inputs)) {
      return node.data.inputs.map((input: any) => ({
        id: input.id || input.name,
        label: input.label || input.name,
        dataType: input.dataType
      }))
    }
    // Default input for nodes without explicit inputs
    return [{ id: 'input', label: '输入', dataType: 'any' }]
  }

  // Get output ports for a node
  const getNodeOutputs = (node: any): PortInfo[] => {
    if (node.data?.outputs && Array.isArray(node.data.outputs)) {
      return node.data.outputs.map((output: any) => ({
        id: output.id || output.name,
        label: output.label || output.name,
        dataType: output.dataType
      }))
    }
    // Default output for nodes without explicit outputs
    return [{ id: 'output', label: '输出', dataType: 'any' }]
  }

  if (nodes.length === 0) {
    return (
      <div className="p-4 text-center">
        <Variable className="w-8 h-8 mx-auto mb-3 text-[var(--color-text-muted)] opacity-50" />
        <p className="text-sm text-[var(--color-text-muted)]">暂无可用变量</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">添加节点后将显示其输入输出变量</p>
      </div>
    )
  }

  return (
    <div className="py-2">
      <div className="px-4 py-2 flex items-center gap-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
        <Variable className="w-3.5 h-3.5" />
        可用变量
      </div>

      <div className="space-y-0.5">
        {nodes.map((node) => {
          const nodeType = node.data?.nodeType as NodeType | undefined
          const nodeLabel = node.data?.label || '未命名节点'
          const nodeColor = nodeType ? nodeTypeColors[nodeType] : 'text-zinc-400'
          const typeName = nodeType ? nodeTypeNames[nodeType] : '未知'
          const inputs = getNodeInputs(node)
          const outputs = getNodeOutputs(node)
          const isExpanded = expandedNodes.has(node.id)

          return (
            <div key={node.id} className="group">
              <button
                onClick={() => toggleNodeExpand(node.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-4 py-2',
                  'hover:bg-[var(--color-bg-input)]/50 transition-colors'
                )}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                )}
                <span className={cn('text-xs', nodeColor)}>{typeName}</span>
                <span className="text-[var(--color-text)] truncate flex-1">{nodeLabel}</span>
              </button>

              {isExpanded && (
                <div className="pl-10 pr-4 pb-1 space-y-1">
                  {/* Inputs section */}
                  {inputs.length > 0 && (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                        <ArrowDownToLine className="w-3 h-3" />
                        输入
                      </div>
                      {inputs.map((input) => {
                        const inputId = input.id || 'input'
                        const uniqueKey = `${node.id}-in-${inputId}`

                        return (
                          <button
                            key={uniqueKey}
                            onClick={() => copyVariable(inputId, uniqueKey)}
                            className={cn(
                              'w-full flex items-center gap-2 px-2 py-1.5 rounded',
                              'text-xs',
                              'hover:bg-[var(--color-bg-input)] transition-colors',
                              'group/item'
                            )}
                          >
                            <code className="text-amber-400 font-mono">{`{{${inputId}}}`}</code>
                            {input.label && (
                              <span className="text-[var(--color-text-muted)] truncate flex-1">
                                {input.label}
                              </span>
                            )}
                            {copiedId === uniqueKey ? (
                              <Check className="w-3.5 h-3.5 text-green-400 ml-auto" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-[var(--color-text-muted)] ml-auto opacity-0 group-hover/item:opacity-100 transition-opacity" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Outputs section */}
                  {outputs.length > 0 && (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                        <ArrowUpFromLine className="w-3 h-3" />
                        输出
                      </div>
                      {outputs.map((output) => {
                        const outputId = output.id || 'output'
                        const uniqueKey = `${node.id}-out-${outputId}`

                        return (
                          <button
                            key={uniqueKey}
                            onClick={() => copyVariable(outputId, uniqueKey)}
                            className={cn(
                              'w-full flex items-center gap-2 px-2 py-1.5 rounded',
                              'text-xs',
                              'hover:bg-[var(--color-bg-input)] transition-colors',
                              'group/item'
                            )}
                          >
                            <code className="text-cyan-400 font-mono">{`{{${outputId}}}`}</code>
                            {output.label && (
                              <span className="text-[var(--color-text-muted)] truncate flex-1">
                                {output.label}
                              </span>
                            )}
                            {copiedId === uniqueKey ? (
                              <Check className="w-3.5 h-3.5 text-green-400 ml-auto" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-[var(--color-text-muted)] ml-auto opacity-0 group-hover/item:opacity-100 transition-opacity" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Help text */}
      <div className="px-4 py-3 mt-2 border-t border-[var(--color-border-subtle)]">
        <p className="text-xs text-[var(--color-text-muted)]">
          点击变量名复制到剪贴板，然后在节点属性中使用 <code className="text-cyan-400">{'{{变量名}}'}</code> 引用
        </p>
      </div>
    </div>
  )
}
