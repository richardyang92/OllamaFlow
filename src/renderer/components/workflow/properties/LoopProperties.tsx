import { useMemo } from 'react'
import type { WorkflowNode, LoopNodeData } from '@/types/node'
import { useWorkflowStore } from '@/store/workflow-store'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<LoopNodeData>) => void
}

export default function LoopProperties({ node, updateNodeData }: Props) {
  const data = node.data as LoopNodeData
  const { nodes } = useWorkflowStore()

  const childNodes = useMemo(() => {
    return nodes.filter(n => n.parentId === node.id)
  }, [nodes, node.id])

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          循环模式
        </label>
        <select
          value={data.loopMode}
          onChange={(e) => updateNodeData(node.id, { loopMode: e.target.value as LoopNodeData['loopMode'] })}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all"
        >
          <option value="count">固定次数</option>
          <option value="array">遍历数组</option>
          <option value="condition">条件循环</option>
        </select>
      </div>

      {data.loopMode === 'count' && (
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">
            循环次数
          </label>
          <input
            type="number"
            value={data.count}
            onChange={(e) => updateNodeData(node.id, { count: parseInt(e.target.value) || 0 })}
            min={0}
            max={10000}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all"
          />
          <p className="text-xs text-zinc-500 mt-1">
            设置循环执行的次数
          </p>
        </div>
      )}

      {data.loopMode === 'array' && (
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">
            数组源
          </label>
          <input
            type="text"
            value={data.arraySource}
            onChange={(e) => updateNodeData(node.id, { arraySource: e.target.value })}
            placeholder="{{items}}"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all font-mono"
          />
          <p className="text-xs text-zinc-500 mt-1">
            使用 {`{{变量名}}`} 引用数组变量，或连接到"数组"输入端口
          </p>
        </div>
      )}

      {data.loopMode === 'condition' && (
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">
            循环条件
          </label>
          <textarea
            value={data.conditionExpression}
            onChange={(e) => updateNodeData(node.id, { conditionExpression: e.target.value })}
            rows={2}
            placeholder="{{index}} < 10"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all resize-none font-mono"
          />
          <p className="text-xs text-zinc-500 mt-1">
            条件为真时继续循环。可用变量: index (当前索引)
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">
            循环变量名
          </label>
          <input
            type="text"
            value={data.loopVariable}
            onChange={(e) => updateNodeData(node.id, { loopVariable: e.target.value })}
            placeholder="item"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">
            索引变量名
          </label>
          <input
            type="text"
            value={data.indexVariable}
            onChange={(e) => updateNodeData(node.id, { indexVariable: e.target.value })}
            placeholder="index"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all font-mono"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          最大迭代次数
        </label>
        <input
          type="number"
          value={data.maxIterations}
          onChange={(e) => updateNodeData(node.id, { maxIterations: parseInt(e.target.value) || 1000 })}
          min={1}
          max={10000}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all"
        />
        <p className="text-xs text-zinc-500 mt-1">
          防止无限循环的安全限制 (最大 10000)
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="collectResults"
          checked={data.collectResults !== false}
          onChange={(e) => updateNodeData(node.id, { collectResults: e.target.checked })}
          className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-0 focus:ring-offset-0"
        />
        <label htmlFor="collectResults" className="text-xs text-zinc-300 cursor-pointer">
          收集每次迭代的结果
        </label>
      </div>

      <div className="border-t border-white/10 pt-4">
        <label className="text-xs font-medium text-zinc-400 mb-2">
          循环体节点 ({childNodes.length} 个)
        </label>
        <p className="text-xs text-zinc-500 mb-2">
          从左侧面板拖拽节点到循环节点区域，或直接将现有节点拖入循环。
        </p>
        {childNodes.length > 0 && (
          <div className="max-h-32 overflow-y-auto space-y-1 bg-white/5 rounded-lg p-2 border border-white/10">
            {childNodes.map(n => (
              <div key={n.id} className="text-xs text-zinc-300 flex items-center gap-2">
                <span className="text-zinc-500">•</span>
                <span className="truncate">{n.data.label || n.id}</span>
                <span className="text-[10px] text-zinc-500">
                  ({n.data.nodeType}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white/5 rounded-lg p-3 text-xs text-zinc-400 border border-white/5">
        <div className="font-medium text-zinc-300 mb-2">输出说明：</div>
        <div className="space-y-1">
          <div><span className="text-cyan-400">当前项</span>: 当前循环的元素（数组模式）或索引</div>
          <div><span className="text-cyan-400">索引</span>: 当前循环的索引 (从 0 开始)</div>
          <div><span className="text-cyan-400">结果列表</span>: 每次迭代的结果数组</div>
          <div><span className="text-cyan-400">完成</span>: 循环完成后的输出</div>
        </div>
        <div className="mt-2 pt-2 border-t border-white/5">
          <div className="font-medium text-zinc-300 mb-1">使用方式：</div>
          <div>• 在循环体节点中使用 {`{{${data.loopVariable}}`} 访问当前项</div>
          <div>• 使用 {`{{${data.indexVariable}}`} 访问当前索引</div>
          <div>• 使用 {`{{isFirst}}`} / {`{{isLast}}`} 判断迭代位置</div>
        </div>
      </div>
    </div>
  )
}
