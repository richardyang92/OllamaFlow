import { useRef } from 'react'
import type { WorkflowNode, SplitterNodeData, PortDefinition } from '@/types/node'
import { useUpdateNodeInternals } from '@xyflow/react'
import { useWorkflowStore } from '@/store/workflow-store'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<SplitterNodeData>) => void
}

function generateOutputPorts(count: number): PortDefinition[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `output${i + 1}`,
    name: `output${i + 1}`,
    label: `输出${i + 1}`,
    dataType: 'any' as const,
  }))
}

export default function SplitterProperties({ node, updateNodeData }: Props) {
  const data = node.data as SplitterNodeData
  const updateNodeInternals = useUpdateNodeInternals()
  const { edges, onEdgesChange } = useWorkflowStore()
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const syncOutputsToPorts = (newCount: number) => {
    const newOutputs = generateOutputPorts(newCount)

    const currentOutputIds = data.outputs.map(p => p.id)
    const newOutputIds = newOutputs.map(p => p.id)
    const removedOutputIds = currentOutputIds.filter(id => !newOutputIds.includes(id))

    if (removedOutputIds.length > 0) {
      const edgesToRemove = edges.filter(
        edge => edge.source === node.id && removedOutputIds.includes(edge.sourceHandle || '')
      )
      
      if (edgesToRemove.length > 0) {
        onEdgesChange(edgesToRemove.map(edge => ({
          type: 'remove',
          id: edge.id,
        })))
      }
    }

    updateNodeData(node.id, {
      outputCount: newCount,
      outputs: newOutputs,
    })

    const relatedEdges = edges.filter(e => e.source === node.id)

    if (relatedEdges.length > 0) {
      const savedEdges = relatedEdges.map(edge => ({ ...edge }))
      const remainingEdges = useWorkflowStore.getState().edges.filter(e => e.source !== node.id)
      useWorkflowStore.setState({ edges: remainingEdges })

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }

      updateTimeoutRef.current = setTimeout(() => {
        const nodeElement = document.querySelector(`[data-id="${node.id}"]`)
        if (nodeElement) {
          void nodeElement.getBoundingClientRect()
        }

        updateNodeInternals(node.id)

        updateTimeoutRef.current = setTimeout(() => {
          const timestamp = Date.now()
          const newRelatedEdges = savedEdges.map((edge, index) => ({
            ...edge,
            id: `${edge.id.split('-r-')[0]}-r-${timestamp}-${index}`,
          }))

          const currentEdges = useWorkflowStore.getState().edges
          useWorkflowStore.setState({ edges: [...currentEdges, ...newRelatedEdges] })

          requestAnimationFrame(() => {
            updateNodeInternals(node.id)
          })
        }, 100)
      }, 100)
    } else {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
      updateTimeoutRef.current = setTimeout(() => {
        updateNodeInternals(node.id)
      }, 100)
    }
  }

  const handleOutputCountChange = (value: number) => {
    const count = Math.max(2, Math.min(10, value))
    if (count !== data.outputCount) {
      syncOutputsToPorts(count)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
          输出端口数量
        </label>
        <input
          type="number"
          value={data.outputCount || 2}
          onChange={(e) => handleOutputCountChange(parseInt(e.target.value) || 2)}
          min={2}
          max={10}
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all"
        />
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          范围: 2-10 个输出端口
        </p>
      </div>

      <div className="bg-[var(--color-bg-input)] rounded-lg p-3 text-xs text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
        <div className="font-medium text-[var(--color-text)] mb-2">节点说明：</div>
        <div className="space-y-1">
          <div>• 接收单路输入值</div>
          <div>• 同时分发到所有输出端口</div>
          <div>• 所有输出获得相同的值</div>
        </div>
      </div>

      <div className="bg-[var(--color-bg-input)] rounded-lg p-3 text-xs border border-[var(--color-border-subtle)]">
        <div className="font-medium text-[var(--color-text)] mb-1">输出格式：</div>
        <pre className="text-[var(--color-text-muted)] overflow-x-auto">
{`输入: "hello"

输出1: "hello"
输出2: "hello"
...`}
        </pre>
      </div>
    </div>
  )
}
