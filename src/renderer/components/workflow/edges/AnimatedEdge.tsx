import { memo } from 'react'
import { EdgeProps, getBezierPath, getSmoothStepPath } from '@xyflow/react'
import { motion } from 'framer-motion'

interface AnimatedEdgeProps extends EdgeProps {
  animated?: boolean
}

function AnimatedEdge(props: AnimatedEdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    style: edgeStyle,
    type,
    animated = false,
    selected,
  } = props

  // Get the path for the edge
  const [edgePath] = type === 'smoothstep'
    ? getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
    : getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })

  // Calculate stroke color based on data or use default
  const strokeColor = data?.hoverColor || data?.baseColor || edgeStyle?.stroke || 'rgba(148, 163, 184, 0.5)'
  const strokeWidth = Number(edgeStyle?.strokeWidth) || 2
  const filterId = `glow-${id}`

  // 根据动画属性决定是否显示动画
  if (animated) {
    return (
      <>
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <motion.path
          id={id}
          d={edgePath}
          stroke={typeof strokeColor === 'string' ? strokeColor : 'rgba(148, 163, 184, 0.5)'}
          strokeWidth={selected ? strokeWidth + 1 : strokeWidth}
          strokeDasharray="8,4"
          fill="none"
          filter={selected ? `url(#${filterId})` : undefined}
          initial={{ strokeDashoffset: 12 }}
          animate={{
            strokeDashoffset: 0,
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            repeatType: 'loop',
            ease: 'linear'
          }}
        />
      </>
    )
  }

  // 非动画模式：静态边
  return (
    <>
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        id={id}
        d={edgePath}
        stroke={typeof strokeColor === 'string' ? strokeColor : 'rgba(148, 163, 184, 0.5)'}
        strokeWidth={selected ? strokeWidth + 1 : strokeWidth}
        fill="none"
        filter={selected ? `url(#${filterId})` : undefined}
      />
    </>
  )
}

export default memo(AnimatedEdge)