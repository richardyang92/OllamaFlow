import type { WorkflowNode, ExecuteCommandNodeData } from '@/types/node'

interface Props {
  node: WorkflowNode
  updateNodeData: (nodeId: string, data: Partial<ExecuteCommandNodeData>) => void
}

export default function ExecuteCommandProperties({ node, updateNodeData }: Props) {
  const data = node.data as ExecuteCommandNodeData

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          命令
          <span className="text-zinc-500 ml-1">(支持 {`{{变量}}`})</span>
        </label>
        <textarea
          value={data.command}
          onChange={(e) => updateNodeData(node.id, { command: e.target.value })}
          rows={3}
          placeholder="echo 'Hello World'"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all resize-none font-mono"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          工作目录
          <span className="text-zinc-500 ml-1">(可选，相对于工作区)</span>
        </label>
        <input
          type="text"
          value={data.cwd}
          onChange={(e) => updateNodeData(node.id, { cwd: e.target.value })}
          placeholder="./scripts"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all font-mono"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          超时时间（秒）
        </label>
        <input
          type="number"
          min="1"
          max="600"
          value={data.timeout / 1000}
          onChange={(e) => updateNodeData(node.id, { timeout: parseInt(e.target.value) * 1000 })}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/8 transition-all"
        />
        <p className="text-xs text-zinc-500 mt-1">命令执行的最长时间，超时将被终止</p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="continueOnError"
          checked={data.continueOnError}
          onChange={(e) => updateNodeData(node.id, { continueOnError: e.target.checked })}
          className="rounded border-white/20 bg-white/5"
        />
        <label htmlFor="continueOnError" className="text-sm text-zinc-300">
          出错时继续执行
        </label>
      </div>

      <div className="bg-white/5 rounded-lg p-3 text-xs text-zinc-400 border border-white/5">
        <div className="font-medium text-zinc-300 mb-2">输出变量：</div>
        <div className="space-y-1">
          <div>• <code className="text-zinc-300">stdout</code>: 标准输出</div>
          <div>• <code className="text-zinc-300">stderr</code>: 标准错误</div>
          <div>• <code className="text-zinc-300">exitCode</code>: 退出码 (0 = 成功)</div>
        </div>
        <div className="mt-2 pt-2 border-t border-white/5">
          <div className="text-zinc-500">使用方式: <code className="text-zinc-300">{`{{command.stdout}}`}</code></div>
        </div>
      </div>
    </div>
  )
}
