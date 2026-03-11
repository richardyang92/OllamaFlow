import { useEffect, useRef } from 'react'
import { useResolvedTheme } from '@/contexts/ThemeContext'

/**
 * macOS 26 Liquid Glass Animated Background
 * Features:
 * - Flowing gradient orbs with blur effects
 * - Subtle particle system
 * - Theme-aware colors
 * - Performance optimized with requestAnimationFrame
 */
export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const resolvedTheme = useResolvedTheme()
  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      ctx.scale(dpr, dpr)
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // macOS 26 inspired gradient orbs
    interface GradientOrb {
      x: number
      y: number
      radius: number
      color1: string
      color2: string
      speedX: number
      speedY: number
      phase: number
      pulseSpeed: number
    }

    const orbs: GradientOrb[] = []

    // Dark mode colors - more vibrant, translucent
    const darkOrbColors = [
      { c1: 'rgba(99, 102, 241, 0.15)', c2: 'rgba(139, 92, 246, 0.08)' },  // Indigo -> Purple
      { c1: 'rgba(59, 130, 246, 0.12)', c2: 'rgba(6, 182, 212, 0.06)' },   // Blue -> Cyan
      { c1: 'rgba(236, 72, 153, 0.10)', c2: 'rgba(244, 114, 182, 0.05)' }, // Pink
      { c1: 'rgba(34, 197, 94, 0.08)', c2: 'rgba(20, 184, 166, 0.04)' },   // Green -> Teal
    ]

    // Light mode colors - subtle, airy
    const lightOrbColors = [
      { c1: 'rgba(99, 102, 241, 0.08)', c2: 'rgba(139, 92, 246, 0.04)' },
      { c1: 'rgba(59, 130, 246, 0.06)', c2: 'rgba(6, 182, 212, 0.03)' },
      { c1: 'rgba(236, 72, 153, 0.05)', c2: 'rgba(244, 114, 182, 0.025)' },
      { c1: 'rgba(34, 197, 94, 0.04)', c2: 'rgba(20, 184, 166, 0.02)' },
    ]

    const orbColors = isDark ? darkOrbColors : lightOrbColors
    const width = window.innerWidth
    const height = window.innerHeight

    // Create flowing orbs
    for (let i = 0; i < 4; i++) {
      const colors = orbColors[i % orbColors.length]
      orbs.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 150 + Math.random() * 200,
        color1: colors.c1,
        color2: colors.c2,
        speedX: 0.15 + Math.random() * 0.25,
        speedY: 0.1 + Math.random() * 0.2,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.0008 + Math.random() * 0.0012,
      })
    }

    // Floating particles
    interface Particle {
      x: number
      y: number
      size: number
      speedX: number
      speedY: number
      alpha: number
      pulse: number
    }

    const particles: Particle[] = []
    for (let i = 0; i < 30; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 1 + Math.random() * 2,
        speedX: 0.1 + Math.random() * 0.3,
        speedY: 0.05 + Math.random() * 0.15,
        alpha: 0.1 + Math.random() * 0.2,
        pulse: Math.random() * Math.PI * 2,
      })
    }

    let animationFrameId: number
    let time = 0

    const animate = () => {
      const w = window.innerWidth
      const h = window.innerHeight

      // Clear with subtle fade for trail effect
      ctx.clearRect(0, 0, w, h)

      time += 1

      // Draw gradient orbs with flowing movement
      orbs.forEach((orb) => {
        const t = time * 0.001 + orb.phase

        // Smooth sine wave movement
        orb.x += orb.speedX
        orb.y += orb.speedY

        // Wrap around edges
        if (orb.x > w + orb.radius) orb.x = -orb.radius
        if (orb.y > h + orb.radius) orb.y = -orb.radius
        if (orb.x < -orb.radius) orb.x = w + orb.radius
        if (orb.y < -orb.radius) orb.y = h + orb.radius

        // Pulsing radius
        const pulseRadius = orb.radius + Math.sin(t * orb.pulseSpeed * 1000) * 30

        // Create radial gradient
        const gradient = ctx.createRadialGradient(
          orb.x, orb.y, 0,
          orb.x, orb.y, pulseRadius
        )
        gradient.addColorStop(0, orb.color1)
        gradient.addColorStop(0.5, orb.color2)
        gradient.addColorStop(1, 'transparent')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(orb.x, orb.y, pulseRadius, 0, Math.PI * 2)
        ctx.fill()
      })

      // Draw floating particles
      particles.forEach((p) => {
        p.x += p.speedX
        p.y += p.speedY
        p.pulse += 0.02

        if (p.x > w) p.x = 0
        if (p.y > h) p.y = 0

        const pulseAlpha = p.alpha + Math.sin(p.pulse) * 0.05
        const pulseSize = p.size + Math.sin(p.pulse) * 0.3

        const particleColor = isDark
          ? `rgba(255, 255, 255, ${pulseAlpha})`
          : `rgba(0, 0, 0, ${pulseAlpha * 0.4})`

        ctx.fillStyle = particleColor
        ctx.beginPath()
        ctx.arc(p.x, p.y, pulseSize, 0, Math.PI * 2)
        ctx.fill()
      })

      // Subtle noise texture overlay (very light)
      if (isDark) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.005)'
        for (let i = 0; i < 50; i++) {
          const x = Math.random() * w
          const y = Math.random() * h
          ctx.fillRect(x, y, 1, 1)
        }
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      cancelAnimationFrame(animationFrameId)
    }
  }, [isDark])

  return (
    <>
      {/* Base gradient layer */}
      <div
        className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-500"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at 30% 20%, rgba(99, 102, 241, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(139, 92, 246, 0.06) 0%, transparent 50%)'
            : 'radial-gradient(ellipse at 30% 20%, rgba(99, 102, 241, 0.04) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(139, 92, 246, 0.03) 0%, transparent 50%)',
        }}
      />
      {/* Animated canvas layer */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          width: '100%',
          height: '100%',
          opacity: isDark ? 1 : 0.8,
        }}
      />
      {/* Subtle vignette for depth */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background: isDark
            ? 'radial-gradient(circle at center, transparent 30%, rgba(0, 0, 0, 0.4) 100%)'
            : 'radial-gradient(circle at center, transparent 30%, rgba(0, 0, 0, 0.05) 100%)',
        }}
      />
    </>
  )
}
