/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#07111F',
        voidDeep: '#060A12',
        surface: '#0D1B2A',
        surface2: '#10283A',
        border: '#1C3A4D',
        ink: '#F3F7FB',
        muted: '#829BAD',
        mint: '#55D6BE',
        amber: '#F5B942',
        coral: '#FF6B6B',
        signal: '#66A3FF',
        violet: '#9B84FF',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(85, 214, 190, 0.15), 0 8px 30px -8px rgba(85, 214, 190, 0.25)',
        amberGlow: '0 0 0 1px rgba(245, 185, 66, 0.18), 0 8px 30px -8px rgba(245, 185, 66, 0.3)',
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 20px 40px -24px rgba(0,0,0,0.6)',
      },
      keyframes: {
        'radar-sweep': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '10%': { opacity: '0.7' },
          '90%': { opacity: '0.7' },
          '100%': { transform: 'translateY(2200%)', opacity: '0' },
        },
        'pulse-dot': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.6)', opacity: '0.4' },
        },
        'drift': {
          '0%, 100%': { transform: 'translate(0px, 0px)' },
          '50%': { transform: 'translate(18px, -14px)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'radar-sweep': 'radar-sweep 4s linear infinite',
        'scan-line': 'scan-line 5s ease-in-out infinite',
        'pulse-dot': 'pulse-dot 2.4s ease-in-out infinite',
        'drift': 'drift 12s ease-in-out infinite',
        'fade-in': 'fade-in 0.4s ease-out',
        'shimmer': 'shimmer 1.6s infinite linear',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(85,214,190,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(85,214,190,0.06) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
}
