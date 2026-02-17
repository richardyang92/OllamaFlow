/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        // 主背景色 - 纯黑
        'space-dark': '#0d0d0d',
        'space-light': '#141414',

        // 面板背景
        'panel-bg': 'rgba(20, 20, 20, 0.85)',
        'card-bg': 'rgba(25, 25, 25, 0.9)',

        // 霓虹强调色
        'neon-blue': '#00d4ff',
        'neon-purple': '#a855f7',
        'neon-yellow': '#facc15',
        'neon-green': '#4ade80',
        'neon-red': '#f87171',
      },
      backgroundImage: {
        // 画布网格渐变背景
        'grid-pattern': `
          linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
        `,
        // 霓虹渐变
        'neon-gradient': 'linear-gradient(135deg, #00d4ff 0%, #a855f7 100%)',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
      boxShadow: {
        // 霓虹发光效果 - 更柔和
        'neon-blue': '0 0 4px rgba(0, 212, 255, 0.3), 0 0 12px rgba(0, 212, 255, 0.2)',
        'neon-purple': '0 0 4px rgba(168, 85, 247, 0.3), 0 0 12px rgba(168, 85, 247, 0.2)',
        'glass': '0 2px 8px 0 rgba(0, 0, 0, 0.3)',
        'card': '0 2px 6px 0 rgba(0, 0, 0, 0.2)',
      },
      backdropBlur: {
        'glass': '12px',
      },
      animation: {
        // 自定义动画
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.8', filter: 'brightness(1.2)' },
        },
      },
    },
  },
  plugins: [],
}
