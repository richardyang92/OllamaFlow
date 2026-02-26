/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx,html}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 主题色板 - 深色模式
        'dark': {
          bg: '#0d0d0d',
          'bg-elevated': '#141414',
          'bg-panel': 'rgba(20, 20, 20, 0.85)',
          'bg-card': 'rgba(25, 25, 25, 0.9)',
          border: 'rgba(255, 255, 255, 0.1)',
          'border-subtle': 'rgba(255, 255, 255, 0.06)',
          text: 'rgba(241, 245, 249, 0.9)',
          'text-muted': 'rgba(161, 161, 170, 0.9)',
          'text-subtle': 'rgba(113, 113, 122, 0.9)',
        },
        // 主题色板 - 浅色模式
        'light': {
          bg: '#f5f5f7',
          'bg-elevated': '#ffffff',
          'bg-panel': 'rgba(255, 255, 255, 0.75)',
          'bg-card': 'rgba(255, 255, 255, 0.9)',
          border: 'rgba(0, 0, 0, 0.1)',
          'border-subtle': 'rgba(0, 0, 0, 0.06)',
          text: 'rgba(15, 23, 42, 0.9)',
          'text-muted': 'rgba(71, 85, 105, 0.9)',
          'text-subtle': 'rgba(100, 116, 139, 0.9)',
        },
        // 霓虹强调色（保留用于节点状态等）
        'neon-blue': '#00d4ff',
        'neon-purple': '#a855f7',
        'neon-yellow': '#facc15',
        'neon-green': '#4ade80',
        'neon-red': '#f87171',
        // 节点类别颜色
        'node': {
          ai: '#a78bfa',
          input: '#22d3ee',
          output: '#2dd4bf',
          logic: '#60a5fa',
          data: '#facc15',
          file: '#fb923c',
          system: '#f87171',
        },
      },
      backgroundImage: {
        'grid-pattern': `
          linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
        `,
        'grid-pattern-light': `
          linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)
        `,
        'neon-gradient': 'linear-gradient(135deg, #00d4ff 0%, #a855f7 100%)',
        'glass-shine': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
      boxShadow: {
        'neon-blue': '0 0 4px rgba(0, 212, 255, 0.3), 0 0 12px rgba(0, 212, 255, 0.2)',
        'neon-purple': '0 0 4px rgba(168, 85, 247, 0.3), 0 0 12px rgba(168, 85, 247, 0.2)',
        'glass': '0 2px 8px 0 rgba(0, 0, 0, 0.3)',
        'glass-light': '0 2px 8px 0 rgba(0, 0, 0, 0.1)',
        'card': '0 2px 6px 0 rgba(0, 0, 0, 0.2)',
        'card-light': '0 2px 6px 0 rgba(0, 0, 0, 0.08)',
        'floating': '0 8px 32px rgba(0, 0, 0, 0.3)',
        'floating-light': '0 8px 32px rgba(0, 0, 0, 0.12)',
      },
      backdropBlur: {
        'glass': '20px',
        'glass-heavy': '30px',
      },
      borderRadius: {
        'glass': '1rem',
        'glass-lg': '1.25rem',
        'glass-xl': '1.5rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'glass-shine': 'glass-shine 3s ease-in-out infinite',
        'refraction': 'refraction 4s ease-in-out infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'slide-left': 'slide-left 0.3s ease-out',
        'slide-right': 'slide-right 0.3s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.8', filter: 'brightness(1.2)' },
        },
        'glass-shine': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'refraction': {
          '0%, 100%': { 
            boxShadow: '0 0 20px rgba(255, 255, 255, 0.1), inset 0 0 20px rgba(255, 255, 255, 0.05)' 
          },
          '50%': { 
            boxShadow: '0 0 30px rgba(255, 255, 255, 0.15), inset 0 0 30px rgba(255, 255, 255, 0.08)' 
          },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-left': {
          '0%': { transform: 'translateX(10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-right': {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      transitionTimingFunction: {
        'glass': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
