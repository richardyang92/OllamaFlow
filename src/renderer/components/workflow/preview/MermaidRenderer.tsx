import { useEffect, useState } from 'react'
import mermaid from 'mermaid'
import { Loader2 } from 'lucide-react'

// 初始化 mermaid 配置（只执行一次）
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'dark',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
})

interface MermaidRendererProps {
  chart: string
}

export default function MermaidRenderer({ chart }: MermaidRendererProps) {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const renderChart = async () => {
      setLoading(true)
      setError(null)
      try {
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        const { svg } = await mermaid.render(id, chart)
        setSvg(svg)
      } catch (err) {
        setError('图表渲染失败')
        console.error('Mermaid render error:', err)
      } finally {
        setLoading(false)
      }
    }
    renderChart()
  }, [chart])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-muted)]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-red-400 text-sm bg-red-500/10 rounded-lg border border-red-500/20">
        {error}
      </div>
    )
  }

  return (
    <div
      className="mermaid-container overflow-auto flex justify-center py-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
