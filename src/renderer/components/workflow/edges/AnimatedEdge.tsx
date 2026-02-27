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
  } = props

  // Get the path for the edge
  const [edgePath] = type === 'smoothstep'
    ? getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
    : getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })

  // Calculate stroke color based on data or use default
  const strokeColor = data?.hoverColor || data?.baseColor || edgeStyle?.stroke || 'rgba(255, 255, 255, 0.15)'
  const strokeWidth = edgeStyle?.strokeWidth || 2

  // 根据动画属性决定是否显示动画
  if (animated) {
    return (
      <motion.path
        id={id}
        d={edgePath}
        stroke={typeof strokeColor === 'string' ? strokeColor : 'rgba(255, 255, 255, 0.15)'}
        strokeWidth={strokeWidth}
        strokeDasharray="8,4"
        fill="none"
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
    )
  }

  // 非动画模式：静态边
  return (
    <path
      id={id}
      d={edgePath}
      stroke={typeof strokeColor === 'string' ? strokeColor : 'rgba(255, 255, 255, 0.15)'}
      strokeWidth={strokeWidth}
      fill="none"
    />
  )
}

export default memo(AnimatedEdge)