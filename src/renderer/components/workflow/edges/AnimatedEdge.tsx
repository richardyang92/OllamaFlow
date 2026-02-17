import { memo } from 'react'
import { EdgeProps, getBezierPath, getSmoothStepPath, EdgeLabelRenderer } from '@xyflow/react'
import { motion, useAnimation } from 'framer-motion'
import { useExecutionStore } from '@/store/execution-store'

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
    style = {}, 
    data, 
    label, 
    labelStyle, 
    labelShowBg, 
    labelBgStyle, 
    labelBgPadding, 
    labelBgBorderRadius, 
    style: edgeStyle,
    type
  } = props

  const controls = useAnimation()
  const executionStore = useExecutionStore()

  // Get the path for the edge
  const [edgePath, labelX, labelY] = type === 'smoothstep' 
    ? getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
    : getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })

  // Calculate stroke color based on data or use default
  const strokeColor = data?.hoverColor || data?.baseColor || edgeStyle?.stroke || 'rgba(255, 255, 255, 0.15)'

  return (
    <>
      <motion.path
        id={id}
        d={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: edgeStyle?.strokeWidth || 2,
          strokeDasharray: '8,4',
          fill: 'none',
        }}
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
      {label && (
        <EdgeLabelRenderer
          x={labelX}
          y={labelY}
          label={label}
          style={labelStyle}
          showBg={labelShowBg}
          bgStyle={labelBgStyle}
          bgPadding={labelBgPadding}
          bgBorderRadius={labelBgBorderRadius}
        />
      )}
    </>
  )
}

export default memo(AnimatedEdge)