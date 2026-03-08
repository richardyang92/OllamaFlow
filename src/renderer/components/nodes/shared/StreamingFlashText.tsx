import { memo } from 'react'
import { motion } from 'framer-motion'

interface StreamingFlashTextProps {
  text: string
  isStreaming: boolean
  maxLength: number
  prefix?: string
  textColor?: string
}

function StreamingFlashText({
  text,
  isStreaming,
  maxLength,
  prefix = '',
  textColor = 'text-[var(--color-text)]'
}: StreamingFlashTextProps) {
  // 截取文本末尾的 maxLength 个字符
  const displayText = text.length > maxLength
    ? '...' + text.slice(-maxLength)
    : text

  return (
    <motion.div
      className="text-xs font-mono truncate"
      animate={isStreaming ? {
        opacity: [0.6, 1, 0.6],
      } : { opacity: 1 }}
      transition={isStreaming ? {
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut'
      } : undefined}
    >
      <span className="text-[var(--color-text-muted)]">{prefix}</span>
      <span className={textColor}>{displayText}</span>
    </motion.div>
  )
}

export default memo(StreamingFlashText)
