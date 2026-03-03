import { memo, useEffect, useRef, useCallback, CSSProperties, MouseEvent } from 'react'
import { shallow } from 'zustand/shallow'
import {
  getInternalNodesBounds,
  getBoundsOfRects,
  XYMinimap,
  type Rect,
  type XYMinimapInstance,
} from '@xyflow/system'
import cc from 'classcat'

import { useStore, useStoreApi, Panel, type Node, type ReactFlowState } from '@xyflow/react'
import { useExecutionStore } from '@/store/execution-store'
import type { WorkflowNodeData } from '@/types/node'

const defaultWidth = 200
const defaultHeight = 150

const filterHidden = (node: Node) => !node.hidden

interface MiniMapProps {
  style?: CSSProperties
  className?: string
  nodeStrokeColor?: string | ((node: Node) => string)
  nodeColor?: string | ((node: Node) => string)
  nodeClassName?: string
  nodeBorderRadius?: number
  nodeStrokeWidth?: number
  bgColor?: string
  maskColor?: string
  maskStrokeColor?: string
  maskStrokeWidth?: number
  viewportBorderRadius?: number
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  onClick?: (event: MouseEvent, position: { x: number; y: number }) => void
  onNodeClick?: (event: MouseEvent, node: Node) => void
  pannable?: boolean
  zoomable?: boolean
  ariaLabel?: string
  inversePan?: boolean
  zoomStep?: number
  offsetScale?: number
}

const selector = (s: ReactFlowState) => {
  const viewBB: Rect = {
    x: -s.transform[0] / s.transform[2],
    y: -s.transform[1] / s.transform[2],
    width: s.width / s.transform[2],
    height: s.height / s.transform[2],
  }

  return {
    viewBB,
    boundingRect:
      s.nodeLookup.size > 0
        ? getBoundsOfRects(getInternalNodesBounds(s.nodeLookup, { filter: filterHidden }), viewBB)
        : viewBB,
    rfId: s.rfId,
    panZoom: s.panZoom,
    translateExtent: s.translateExtent,
    flowWidth: s.width,
    flowHeight: s.height,
    ariaLabelConfig: s.ariaLabelConfig,
  }
}

function generateRoundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  rx: number,
  ry?: number
): string {
  const rY = ry ?? rx
  const w = Math.max(0, width)
  const h = Math.max(0, height)
  const rX = Math.min(rx, w / 2)
  const rYActual = Math.min(rY, h / 2)

  if (rX === 0 && rYActual === 0) {
    return `M${x},${y}h${w}v${h}h${-w}z`
  }

  return `M${x + rX},${y}h${w - 2 * rX}a${rX},${rYActual} 0 0 1 ${rX},${rYActual}v${h - 2 * rYActual}a${rX},${rYActual} 0 0 1 ${-rX},${rYActual}h${-w + 2 * rX}a${rX},${rYActual} 0 0 1 ${-rX},${-rYActual}v${-h + 2 * rYActual}a${rX},${rYActual} 0 0 1 ${rX},${-rYActual}z`
}

function generateMaskPath(
  outerX: number,
  outerY: number,
  outerWidth: number,
  outerHeight: number,
  innerX: number,
  innerY: number,
  innerWidth: number,
  innerHeight: number,
  borderRadius: number
): string {
  const outerPath = `M${outerX},${outerY}h${outerWidth}v${outerHeight}h${-outerWidth}z`
  const innerPath = generateRoundedRectPath(innerX, innerY, innerWidth, innerHeight, borderRadius)
  return `${outerPath} ${innerPath}`
}

function getNodeColorByType(nodeType: string): string {
  const colorMap: Record<string, string> = {
    input: 'var(--color-node-input)',
    output: 'var(--color-node-output)',
    ollamaChat: 'var(--color-node-ai)',
    reactAgent: 'var(--color-node-ai)',
    smartRouter: 'var(--color-node-ai)',
    if: 'var(--color-node-logic)',
    loop: 'var(--color-node-logic)',
    set: 'var(--color-node-data)',
    readFile: 'var(--color-node-file)',
    writeFile: 'var(--color-node-file)',
    executeCommand: 'var(--color-node-system)',
    image: 'var(--color-node-data)',
    queue: 'var(--color-node-logic)',
    splitter: 'var(--color-node-data)',
  }
  return colorMap[nodeType] || 'var(--color-border)'
}

function MiniMapComponent({
  style,
  className,
  nodeStrokeColor,
  nodeColor,
  nodeClassName = '',
  nodeBorderRadius = 5,
  nodeStrokeWidth,
  bgColor,
  maskColor,
  maskStrokeColor = 'var(--glass-border)',
  maskStrokeWidth = 2,
  viewportBorderRadius = 8,
  position = 'bottom-right',
  onClick,
  onNodeClick,
  pannable = true,
  zoomable = true,
  ariaLabel,
  inversePan,
  zoomStep = 1,
  offsetScale = 5,
}: MiniMapProps) {
  const store = useStoreApi<Node<WorkflowNodeData>>()
  const svg = useRef<SVGSVGElement>(null)

  // Get node results from current workspace
  const nodeResults = useExecutionStore((state) => {
    const wsPath = state.currentWorkspacePath
    if (!wsPath) return undefined
    const ws = state.workspaces.get(wsPath)
    return ws?.context?.nodeResults
  })

  const { boundingRect, viewBB, rfId, panZoom, translateExtent, flowWidth, flowHeight, ariaLabelConfig } = useStore(
    selector,
    shallow
  )

  const elementWidth = (style?.width as number) ?? defaultWidth
  const elementHeight = (style?.height as number) ?? defaultHeight
  const scaledWidth = boundingRect.width / elementWidth
  const scaledHeight = boundingRect.height / elementHeight
  const viewScale = Math.max(scaledWidth, scaledHeight)
  const viewWidth = viewScale * elementWidth
  const viewHeight = viewScale * elementHeight
  const offset = offsetScale * viewScale
  const x = boundingRect.x - (viewWidth - boundingRect.width) / 2 - offset
  const y = boundingRect.y - (viewHeight - boundingRect.height) / 2 - offset
  const width = viewWidth + offset * 2
  const height = viewHeight + offset * 2
  const labelledBy = `react-flow__minimap-desc-${rfId}`
  const viewScaleRef = useRef(0)
  const minimapInstance = useRef<XYMinimapInstance>()

  viewScaleRef.current = viewScale

  useEffect(() => {
    if (svg.current && panZoom) {
      minimapInstance.current = XYMinimap({
        domNode: svg.current,
        panZoom,
        getTransform: () => store.getState().transform,
        getViewScale: () => viewScaleRef.current,
      })

      return () => {
        minimapInstance.current?.destroy()
      }
    }
  }, [panZoom])

  useEffect(() => {
    minimapInstance.current?.update({
      translateExtent,
      width: flowWidth,
      height: flowHeight,
      inversePan,
      pannable,
      zoomStep,
      zoomable,
    })
  }, [pannable, zoomable, inversePan, zoomStep, translateExtent, flowWidth, flowHeight])

  const onSvgClick = onClick
    ? (event: MouseEvent) => {
        const [clickX, clickY] = minimapInstance.current?.pointer(event) || [0, 0]
        onClick(event, { x: clickX, y: clickY })
      }
    : undefined

  const handleNodeClick = useCallback(
    (event: MouseEvent, nodeId: string) => {
      const node = store.getState().nodeLookup.get(nodeId)
      if (node) {
        onNodeClick?.(event, node.internals.userNode)
      }
    },
    [onNodeClick]
  )

  const onSvgNodeClick = onNodeClick ? handleNodeClick : undefined

  const _ariaLabel = ariaLabel ?? ariaLabelConfig?.['minimap.ariaLabel']

  const getNodeColor = useCallback(
    (node: Node<WorkflowNodeData>): string => {
      const result = nodeResults?.get(node.id)
      if (result) {
        switch (result.status) {
          case 'running':
            return '#eab308'
          case 'success':
            return '#22c55e'
          case 'error':
            return '#ef4444'
        }
      }

      if (typeof nodeColor === 'function') {
        return nodeColor(node)
      }
      if (typeof nodeColor === 'string') {
        return nodeColor
      }

      return getNodeColorByType(node.data?.nodeType || '')
    },
    [nodeColor, nodeResults]
  )

  const getNodeStrokeColor = useCallback(
    (node: Node<WorkflowNodeData>): string => {
      if (typeof nodeStrokeColor === 'function') {
        return nodeStrokeColor(node)
      }
      return nodeStrokeColor || 'transparent'
    },
    [nodeStrokeColor]
  )

  const maskPath = generateMaskPath(
    x - offset,
    y - offset,
    width + offset * 2,
    height + offset * 2,
    viewBB.x,
    viewBB.y,
    viewBB.width,
    viewBB.height,
    viewportBorderRadius * viewScale
  )

  const nodes = store.getState().nodeLookup

  return (
    <Panel
      position={position}
      style={
        {
          ...style,
          overflow: 'hidden',
          '--xy-minimap-background-color-props': typeof bgColor === 'string' ? bgColor : undefined,
          '--xy-minimap-mask-background-color-props': typeof maskColor === 'string' ? maskColor : undefined,
          '--xy-minimap-mask-stroke-color-props': typeof maskStrokeColor === 'string' ? maskStrokeColor : undefined,
          '--xy-minimap-mask-stroke-width-props':
            typeof maskStrokeWidth === 'number' ? maskStrokeWidth * viewScale : undefined,
        } as CSSProperties
      }
      className={cc(['react-flow__minimap', className])}
      data-testid="rf__minimap"
    >
      <svg
        width={elementWidth}
        height={elementHeight}
        viewBox={`${x} ${y} ${width} ${height}`}
        className="react-flow__minimap-svg"
        role="img"
        aria-labelledby={labelledBy}
        ref={svg}
        onClick={onSvgClick}
        style={{ overflow: 'visible' }}
      >
        {_ariaLabel && <title id={labelledBy}>{_ariaLabel}</title>}

        <rect
          x={x - offset}
          y={y - offset}
          width={width + offset * 2}
          height={height + offset * 2}
          fill="var(--xy-minimap-background-color-default, var(--glass-bg))"
          rx={12}
          ry={12}
        />

        {Array.from(nodes.values()).map((node) => {
          const { position: nodePosition, measured, data } = node
          const nodeWidth = measured?.width ?? (data?.width as number | undefined) ?? 100
          const nodeHeight = measured?.height ?? (data?.height as number | undefined) ?? 50
          const color = getNodeColor(node as Node<WorkflowNodeData>)
          const stroke = getNodeStrokeColor(node as Node<WorkflowNodeData>)

          return (
            <rect
              key={node.id}
              className={cc(['react-flow__minimap-node', nodeClassName])}
              x={nodePosition.x}
              y={nodePosition.y}
              width={nodeWidth}
              height={nodeHeight}
              fill={color}
              stroke={stroke}
              strokeWidth={nodeStrokeWidth}
              rx={nodeBorderRadius}
              ry={nodeBorderRadius}
              onClick={(event) => {
                event.stopPropagation()
                onSvgNodeClick?.(event as unknown as MouseEvent, node.id)
              }}
            />
          )
        })}

        <path
          className="react-flow__minimap-mask"
          d={maskPath}
          fillRule="evenodd"
          pointerEvents="none"
          stroke={maskStrokeColor}
          strokeWidth={maskStrokeWidth * viewScale}
          fill={maskColor || 'var(--xy-minimap-mask-background-color-default)'}
        />
      </svg>
    </Panel>
  )
}

MiniMapComponent.displayName = 'MiniMap'

export const MiniMap = memo(MiniMapComponent)
