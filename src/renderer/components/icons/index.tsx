import {
  ArrowDownToLine,
  Bot,
  Pencil,
  GitBranch,
  GitMerge,
  Repeat,
  Route,
  ArrowUpFromLine,
  Image,
  FileText,
  Save,
  Terminal,
  Brain,
  ChevronDown,
  Check,
  Trash2,
  Target,
  FolderOpen,
  File,
  Microscope,
  Folder,
  Sparkles,
  ListOrdered,
  Split,
} from 'lucide-react'

export const NodeIconMap = {
  input: ArrowDownToLine,
  ollamaChat: Bot,
  ollamaChatDebug: Microscope,
  set: Pencil,
  if: GitBranch,
  loop: Repeat,
  smartRouter: Route,
  output: ArrowUpFromLine,
  image: Image,
  readFile: FileText,
  writeFile: Save,
  executeCommand: Terminal,
  reactAgent: Brain,
  queue: ListOrdered,
  splitter: Split,
  join: GitMerge,
} as const

export const UIIconMap = {
  chevronDown: ChevronDown,
  check: Check,
  trash: Trash2,
  target: Target,
  folderOpen: FolderOpen,
  file: File,
  folder: Folder,
  sparkles: Sparkles,
} as const

export type NodeIconType = keyof typeof NodeIconMap
export type UIIconType = keyof typeof UIIconMap

export function getNodeIcon(type: NodeIconType, className?: string) {
  const Icon = NodeIconMap[type]
  return Icon ? <Icon className={className} /> : null
}

export function getUIIcon(type: UIIconType, className?: string) {
  const Icon = UIIconMap[type]
  return Icon ? <Icon className={className} /> : null
}
