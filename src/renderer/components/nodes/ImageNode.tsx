import { memo, useEffect, useState } from 'react'
import { NodeProps } from '@xyflow/react'
import BaseNode from './BaseNode'
import { ImageNodeData } from '@/types/node'
import { cn } from '@/lib/utils'
import { useExecutionStore } from '@/store/execution-store'
import { useWorkspaceStore } from '@/store/workspace-store'

function ImageNode(props: NodeProps) {
  const data = props.data as ImageNodeData
  const id = props.id as string
  const nodeResult = useExecutionStore((state) => state.getNodeStatus(id))
  const currentWorkspace = useWorkspaceStore((state) => state.currentWorkspace)
  
  // Safely get imageUrl from node result or node data
  let imageUrl: string | undefined = data.imageUrl
  
  if (nodeResult?.output) {
    if (typeof nodeResult.output === 'object' && nodeResult.output !== null) {
      // Handle object output (most common case)
      imageUrl = (nodeResult.output as Record<string, unknown>).data as string
    } else if (typeof nodeResult.output === 'string') {
      // Handle string output directly
      imageUrl = nodeResult.output
    }
  }
  
  const [imageDataUrl, setImageDataUrl] = useState<string>('')
  const [loadError, setLoadError] = useState<boolean>(false)

  useEffect(() => {
    const loadImage = async () => {
      if (!imageUrl || !currentWorkspace?.path) {
        setImageDataUrl('')
        setLoadError(false)
        return
      }

      try {
        console.log('Loading image:', imageUrl)
        console.log('Current workspace path:', currentWorkspace.path)
        
        // Check if the URL is already a data URL
        if (imageUrl.startsWith('data:')) {
          console.log('Using data URL directly')
          setImageDataUrl(imageUrl)
          setLoadError(false)
          return
        }

        // Check if it's a local file path within the workspace
        let relativePath = imageUrl
        
        // Remove file:// protocol if present
        if (relativePath.startsWith('file://')) {
          console.log('Processing file:// URL')
          // Convert file URL to relative path
          const workspacePath = currentWorkspace.path.replace(/\\/g, '/').toLowerCase()
          console.log('Normalized workspace path:', workspacePath)
          
          // Remove file:// prefix and normalize path
          let filePath = relativePath.replace('file:///', '').replace(/\\/g, '/').toLowerCase()
          // For Windows paths, ensure we have the correct format
          if (filePath.match(/^[a-z]:/)) {
            // Already has drive letter, keep it
          } else if (filePath.match(/^\/[a-z]:/)) {
            // Remove leading slash for Windows paths
            filePath = filePath.substring(1)
          }
          console.log('Normalized file path:', filePath)
          
          if (filePath.startsWith(workspacePath)) {
            relativePath = filePath.substring(workspacePath.length).replace(/^\//, '')
            console.log('Converted to relative path:', relativePath)
          } else {
            console.log('File path is outside workspace, using as absolute path')
            // If file is outside workspace, try to use it directly (this might fail due to security restrictions)
          }
        }

        // If it's a relative path or absolute path within workspace, use IPC to read the image
        if (!relativePath.startsWith('http://') && !relativePath.startsWith('https://')) {
          console.log('Using IPC to read image:', relativePath)
          const result = await window.electronAPI.file.readImage(currentWorkspace.path, relativePath)
          console.log('IPC readImage result:', result)
          if (result.success && result.dataUrl) {
            setImageDataUrl(result.dataUrl)
            setLoadError(false)
          } else {
            console.error('IPC readImage failed:', result.error)
            setImageDataUrl('')
            setLoadError(true)
          }
        } else {
          // For external URLs, use directly
          console.log('Using external URL directly:', relativePath)
          setImageDataUrl(relativePath)
          setLoadError(false)
        }
      } catch (error) {
        console.error('Failed to load image:', error)
        setImageDataUrl('')
        setLoadError(true)
      }
    }

    loadImage()
  }, [imageUrl, currentWorkspace?.path])

  const handleImageClick = () => {
    if (imageDataUrl) {
      // Create global modal element
      const modalElement = document.createElement('div')
      modalElement.id = 'image-preview-modal'
      modalElement.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm'
      modalElement.onclick = () => {
        document.body.removeChild(modalElement)
      }

      // Create modal content
      const modalContent = document.createElement('div')
      modalContent.className = 'relative bg-zinc-900 rounded-lg p-4 m-4 max-w-[90vw] max-h-[90vh] overflow-auto'
      modalContent.onclick = (e) => e.stopPropagation()

      // Create close button
      const closeButton = document.createElement('button')
      closeButton.className = 'absolute top-2 right-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full p-1 transition-colors'
      closeButton.textContent = '×'
      closeButton.onclick = () => {
        document.body.removeChild(modalElement)
      }

      // Create image element
      const imageElement = document.createElement('img')
      imageElement.src = imageDataUrl
      imageElement.alt = '完整预览'
      imageElement.className = 'max-w-full max-h-[80vh] object-contain rounded'

      // Create URL info
      const urlInfo = document.createElement('div')
      urlInfo.className = 'mt-4 text-center text-zinc-400 text-sm'
      urlInfo.textContent = imageUrl || ''

      // Assemble modal
      modalContent.appendChild(closeButton)
      modalContent.appendChild(imageElement)
      modalContent.appendChild(urlInfo)
      modalElement.appendChild(modalContent)

      // Add to document body
      document.body.appendChild(modalElement)
    }
  }

  return (
    <BaseNode {...props} icon="🖼️">
      <div className="text-xs space-y-2">
        {imageUrl && (
          <div className="space-y-2">
            <div className="text-gray-400">图片URL:</div>
            <div className={cn(
              'bg-white/5 rounded-md p-2',
              'text-zinc-300 font-mono text-xs',
              'border border-white/10',
              'max-h-12',
              'overflow-y-auto'
            )}>
              {imageUrl}
            </div>
            <div className={cn(
              'bg-white/5 rounded-md p-2',
              'border border-white/10',
              'flex items-center justify-center',
              'cursor-pointer hover:bg-white/10 transition-colors'
            )} onClick={handleImageClick}>
              {imageDataUrl ? (
                <img 
                  src={imageDataUrl} 
                  alt="Preview" 
                  className="max-w-full max-h-32 object-contain rounded"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                  }}
                />
              ) : loadError ? (
                <div className="text-zinc-400">图片加载失败</div>
              ) : (
                <div className="text-zinc-400">加载中...</div>
              )}
              <div className="hidden text-zinc-400">图片加载失败</div>
            </div>
          </div>
        )}
        {!imageUrl && (
          <div className="text-zinc-400">等待输入图片URL...</div>
        )}
      </div>
    </BaseNode>
  )
}

export default memo(ImageNode)