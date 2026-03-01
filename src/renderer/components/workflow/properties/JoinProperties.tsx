import { useRef } from 'react'
import type { WorkflowNode, JoinNodeData, PortDefinition } from '@/types/node'
import { useUpdateNodeInternals } from '@xyflow/react'
import { useWorkflowStore } from '@/store/workflow-store'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<JoinNodeData>) => void
}

function generateInputPorts(count: number): PortDefinition[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `input${i + 1}`,
    name: `input${i + 1}`,
    label: `输入${i + 1}`,
    dataType: 'any' as const,
  }))
}

export default function JoinProperties({ node, updateNodeData }: Props) {
  const data = node.data as JoinNodeData
  const updateNodeInternals = useUpdateNodeInternals()
  const { edges, onEdgesChange } = useWorkflowStore()
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const syncInputsToPorts = (newCount: number) => {
    const newInputs = generateInputPorts(newCount)

    const currentInputIds = data.inputs.map(p => p.id)
    const newInputIds = newInputs.map(p => p.id)
    const removedInputIds = currentInputIds.filter(id => !newInputIds.includes(id))

    if (removedInputIds.length > 0) {
      const edgesToRemove = edges.filter(
        edge => edge.target === node.id && removedInputIds.includes(edge.targetHandle || 'input')
      )
      
      if (edgesToRemove.length > 0) {
        onEdgesChange(edgesToRemove.map(edge => ({
          type: 'remove',
          id: edge.id,
        })))
      }
    }

    updateNodeData(node.id, {
      inputCount: newCount,
      inputs: newInputs,
    })

    const relatedEdges = edges.filter(e => e.target === node.id)

    if (relatedEdges.length > 0) {
      const savedEdges = relatedEdges.map(edge => ({ ...edge }))
      const remainingEdges = useWorkflowStore.getState().edges.filter(e => e.target !== node.id)
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

  const handleInputCountChange = (value: number) => {
    const count = Math.max(2, Math.min(10, value))
    if (count !== data.inputCount) {
      syncInputsToPorts(count)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
          输入端口数量
        </label>
        <input
          type="number"
          value={data.inputCount || 2}
          onChange={(e) => handleInputCountChange(parseInt(e.target.value) || 2)}
          min={2}
          max={10}
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)] transition-all"
        />
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          范围: 2-10 个输入端口
        </p>
      </div>

      <div className="bg-[var(--color-bg-input)] rounded-lg p-3 text-xs text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]">
        <div className="font-medium text-[var(--color-text)] mb-2">节点说明：</div>
        <div className="space-y-1">
          <div>• 等待所有输入端口都有值</div>
          <div>• 收集所有输入后输出对象</div>
          <div>• 配合分发节点实现并行执行</div>
        </div>
      </div>

      <div className="bg-[var(--color-bg-input)] rounded-lg p-3 text-xs border border-[var(--color-border-subtle)]">
        <div className="font-medium text-[var(--color-text)] mb-1">输出格式：</div>
        <pre className="text-[var(--color-text-muted)] overflow-x-auto">
{`{
  "input1": <分支1结果>,
  "input2": <分支2结果>,
  ...
}`}
        </pre>
      </div>
    </div>
  )
}
