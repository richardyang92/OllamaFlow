import type { WorkflowNode } from '@/types/node'
import { useState } from 'react'
import { useWorkflowStore } from '@/store/workflow-store'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, Check } from 'lucide-react'
import InputProperties from './properties/InputProperties'
import OllamaChatProperties from './properties/OllamaChatProperties'
import SetProperties from './properties/SetProperties'
import IfProperties from './properties/IfProperties'
import LoopProperties from './properties/LoopProperties'
import SmartRouterProperties from './properties/SmartRouterProperties'
import OutputProperties from './properties/OutputProperties'
import ReadFileProperties from './properties/ReadFileProperties'
import WriteFileProperties from './properties/WriteFileProperties'
import ExecuteCommandProperties from './properties/ExecuteCommandProperties'
import ReactAgentProperties from './properties/ReactAgentProperties'
import ImageProperties from './properties/ImageProperties'
import QueueProperties from './properties/QueueProperties'
import SplitterProperties from './properties/SplitterProperties'
import JoinProperties from './properties/JoinProperties'
import { cn } from '@/lib/utils'

function EditFeedback({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg glass-floating text-green-400 text-sm font-medium shadow-lg flex items-center gap-2"
    >
      <Check className="w-4 h-4" />
      {message}
    </motion.div>
  )
}

function PropertiesPanelContent({ 
  selectedNode, 
  selectedNodeId, 
  updateNodeData, 
  deleteNode, 
  onClose,
  isDrawer = false 
}: {
  selectedNode: any
  selectedNodeId: string
  updateNodeData: (nodeId: string, data: Partial<any>) => void
  deleteNode: (nodeId: string) => void
  onClose: () => void
  isDrawer?: boolean
}) {
  const { selectNode } = useWorkflowStore()
  const [editFeedback, setEditFeedback] = useState<string | null>(null)

  const handleDelete = () => {
    deleteNode(selectedNodeId)
    selectNode(null)
  }

  const safeUpdateNodeData = (nodeId: string, data: Partial<any>) => {
    const currentWorkflowStore = useWorkflowStore.getState();
    const workflowNodes = currentWorkflowStore.nodes;
    if (workflowNodes.some(n => n.id === nodeId)) {
      updateNodeData(nodeId, data);
      setEditFeedback('已更新');
      setTimeout(() => setEditFeedback(null), 2000);
    }
  };

  const renderProperties = () => {
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
      case 'smartRouter':
        return <SmartRouterProperties node={selectedNode} updateNodeData={safeUpdateNodeData} />
      case 'output':
        return <OutputProperties node={selectedNode} updateNodeData={safeUpdateNodeData} />
      case 'image':
        return <ImageProperties node={selectedNode} updateNodeData={safeUpdateNodeData} />
      case 'readFile':
        return <ReadFileProperties node={selectedNode} updateNodeData={safeUpdateNodeData} />
      case 'writeFile':
        return <WriteFileProperties node={selectedNode} updateNodeData={safeUpdateNodeData} />
      case 'executeCommand':
        return <ExecuteCommandProperties node={selectedNode} updateNodeData={safeUpdateNodeData} />
      case 'reactAgent':
        return <ReactAgentProperties node={selectedNode} updateNodeData={safeUpdateNodeData} />
      case 'queue':
        return <QueueProperties node={selectedNode} updateNodeData={safeUpdateNodeData} />
      case 'splitter':
        return <SplitterProperties node={selectedNode} updateNodeData={safeUpdateNodeData} />
      case 'join':
        return <JoinProperties node={selectedNode} updateNodeData={safeUpdateNodeData} />
      default:
        return (
          <div className="text-[var(--color-text-muted)] text-sm">此节点类型没有可配置的属性.</div>
        )
    }
  }

  const content = (
    <>
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence>
          <motion.div
            key={selectedNodeId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
                标签
              </label>
              <input
                type="text"
                value={selectedNode.data.label}
                onChange={(e) => {
                  const currentWorkflowStore = useWorkflowStore.getState();
                  const workflowNodes = currentWorkflowStore.nodes;
                  if (workflowNodes.some(n => n.id === selectedNodeId)) {
                    updateNodeData(selectedNodeId, { label: e.target.value });
                  }
                }}
                className={cn(
                  'w-full px-3 py-2 rounded-lg',
                  'bg-[var(--color-bg-input)]',
                  'border border-[var(--color-border-subtle)]',
                  'text-[var(--color-text)] text-sm',
                  'placeholder:text-[var(--color-text-muted)]',
                  'focus:outline-none focus:border-[var(--color-border)] focus:bg-[var(--color-bg-hover)]',
                  'transition-all duration-200'
                )}
              />
            </div>

            {renderProperties()}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="p-4 border-t border-[var(--color-border-subtle)]">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleDelete}
          className={cn(
            'w-full px-4 py-2 rounded-lg',
            'flex items-center justify-center gap-2',
            'text-red-400',
            'bg-red-500/10',
            'border border-red-500/20',
            'hover:bg-red-500/20 hover:border-red-500/30',
            'transition-all duration-200',
            'text-sm font-medium'
          )}
        >
          <Trash2 className="w-4 h-4" />
          删除节点
        </motion.button>
      </div>
    </>
  )

  if (isDrawer) {
    return (
      <>
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--color-text)]">属性</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-input)] transition-all"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {content}
        </div>

        <AnimatePresence>
          {editFeedback && <EditFeedback message={editFeedback} />}
        </AnimatePresence>
      </>
    )
  }

  return (
    <>
      <motion.aside
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="my-4 ml-0 mr-4 w-80 glass-panel rounded-glass-lg flex flex-col"
      >
        <div className="px-4 py-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between rounded-t-glass-lg">
          <h2 className="text-sm font-medium text-[var(--color-text)]">属性</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-input)] transition-all"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {content}
      </motion.aside>

      <AnimatePresence>
        {editFeedback && <EditFeedback message={editFeedback} />}
      </AnimatePresence>
    </>
  )
}

export default function 属性Panel({ onClose, isDrawer = false }: { onClose: () => void; isDrawer?: boolean }) {
  const { selectedNodeId, nodes, updateNodeData, deleteNode } = useWorkflowStore()
  const selectedNode = nodes.find(n => n.id === selectedNodeId) as WorkflowNode | undefined

  if (!selectedNode) {
    if (isDrawer) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="text-4xl mb-3 opacity-50">🎯</div>
            <p className="text-[var(--color-text-muted)] text-sm">选择一个节点以编辑其属性</p>
          </div>
        </div>
      )
    }

    return (
      <motion.aside
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="my-4 ml-0 mr-4 w-80 glass-panel rounded-glass-lg flex items-center justify-center"
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="text-4xl mb-3 opacity-50">🎯</div>
          <p className="text-[var(--color-text-muted)] text-sm">选择一个节点以编辑其属性</p>
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
      isDrawer={isDrawer}
    />
  )
}
