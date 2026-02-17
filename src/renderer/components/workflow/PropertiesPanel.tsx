import { useState } from 'react'
import { useWorkflowStore } from '@/store/workflow-store'
import { motion, AnimatePresence } from 'framer-motion'
import InputProperties from './properties/InputProperties'
import OllamaChatProperties from './properties/OllamaChatProperties'
import SetProperties from './properties/SetProperties'
import IfProperties from './properties/IfProperties'
import LoopProperties from './properties/LoopProperties'
import OutputProperties from './properties/OutputProperties'
import ReadFileProperties from './properties/ReadFileProperties'
import WriteFileProperties from './properties/WriteFileProperties'
import ExecuteCommandProperties from './properties/ExecuteCommandProperties'
import { cn } from '@/lib/utils'

// Toast notification component
function EditFeedback({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg bg-green-500/20 backdrop-blur-md border border-green-500/30 text-green-400 text-sm font-medium shadow-lg"
    >
      ✓ {message}
    </motion.div>
  )
}

function PropertiesPanelContent({ selectedNode, selectedNodeId, updateNodeData, deleteNode, onClose }: {
  selectedNode: any
  selectedNodeId: string
  updateNodeData: (nodeId: string, data: Partial<any>) => void
  deleteNode: (nodeId: string) => void
  onClose: () => void
}) {
  const { selectNode } = useWorkflowStore()
  const [editFeedback, setEditFeedback] = useState<string | null>(null)

  const handleDelete = () => {
    deleteNode(selectedNodeId)
    selectNode(null)
  }

  // Create a safe version of updateNodeData with feedback
  const safeUpdateNodeData = (nodeId: string, data: Partial<any>) => {
    // Check if node still exists before updating
    const currentWorkflowStore = useWorkflowStore.getState();
    const workflowNodes = currentWorkflowStore.nodes;
    if (workflowNodes.some(n => n.id === nodeId)) {
      updateNodeData(nodeId, data);
      // Show feedback
      setEditFeedback('已更新');
      setTimeout(() => setEditFeedback(null), 2000);
    }
  };

  const render属性 = () => {
    switch (selectedNode.data.nodeType) {
      case 'input':
        return <InputProperties node={selectedNode} updateNodeData={safeUpdateNodeData} />
      case 'ollamaChat':
        return <OllamaChatProperties node={selectedNode} updateNodeData={safeUpdateNodeData} />
      case 'set':
        return <SetProperties node={selectedNode} updateNodeData={safeUpdateNodeData} />
      case 'if':
        return <IfProperties node={selectedNode} updateNodeData={safeUpdateNodeData} />
      case 'loop':
        return <LoopProperties node={selectedNode} updateNodeData={safeUpdateNodeData} />
      case 'output':
        return <OutputProperties node={selectedNode} updateNodeData={safeUpdateNodeData} />
      case 'image':
        return <div className="space-y-4">
          <div className="bg-white/5 rounded-lg p-3 text-xs text-zinc-400 border border-white/5">
            <div className="font-medium text-zinc-300 mb-1">说明：</div>
            <div>此节点用于显示图片，输入应为有效的图片URL</div>
          </div>
        </div>
      case 'readFile':
        return <ReadFileProperties node={selectedNode} updateNodeData={safeUpdateNodeData} />
      case 'writeFile':
        return <WriteFileProperties node={selectedNode} updateNodeData={safeUpdateNodeData} />
      case 'executeCommand':
        return <ExecuteCommandProperties node={selectedNode} updateNodeData={safeUpdateNodeData} />
      default:
        return (
          <div className="text-zinc-400 text-sm">此节点类型没有可配置的属性.</div>
        )
    }
  }

  return (
    <>
      <motion.aside
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="my-4 ml-0 mr-4 w-80 bg-panel-bg backdrop-blur-md rounded-xl border border-white/10 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between rounded-t-xl">
          <h2 className="text-sm font-medium text-zinc-100">属性</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-xs transition-colors"
            title="收起"
          >
            ▼
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence>
            <motion.div
              key={selectedNodeId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Node label */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  标签
                </label>
                <input
                  type="text"
                  value={selectedNode.data.label}
                  onChange={(e) => {
                    // Check if node still exists before updating
                    const currentWorkflowStore = useWorkflowStore.getState();
                    const workflowNodes = currentWorkflowStore.nodes;
                    if (workflowNodes.some(n => n.id === selectedNodeId)) {
                      updateNodeData(selectedNodeId, { label: e.target.value });
                    }
                  }}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg',
                    'bg-white/5',
                    'border border-white/10',
                    'text-white text-sm',
                    'placeholder:text-zinc-500',
                    'focus:outline-none focus:border-white/20 focus:bg-white/8',
                    'transition-all duration-200'
                  )}
                />
              </div>

              {/* Node-specific properties */}
              {render属性()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDelete}
            className="btn-sci-fi btn-danger w-full"
          >
            🗑 删除节点
          </motion.button>
        </div>
      </motion.aside>

      {/* Edit feedback toast */}
      <AnimatePresence>
        {editFeedback && <EditFeedback message={editFeedback} />}
      </AnimatePresence>
    </>
  )
}

export default function 属性Panel({ onClose }: { onClose: () => void }) {
  const { selectedNodeId, getSelectedNode, updateNodeData, deleteNode } = useWorkflowStore()
  const selectedNode = getSelectedNode()

  if (!selectedNode) {
    return (
      <motion.aside
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="my-4 ml-0 mr-4 w-80 bg-panel-bg backdrop-blur-md rounded-xl border border-white/10 shadow-2xl flex items-center justify-center"
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="text-4xl mb-3 opacity-50">🎯</div>
          <p className="text-zinc-400 text-sm">选择一个节点以编辑其属性</p>
        </div>
      </motion.aside>
    )
  }

  return (
    <PropertiesPanelContent
      key={selectedNodeId}
      selectedNode={selectedNode}
      selectedNodeId={selectedNodeId!}
      updateNodeData={updateNodeData}
      deleteNode={deleteNode}
      onClose={onClose}
    />
  )
}
