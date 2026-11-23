/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        void: '#05070a',
        obsidian: '#0a0e14',
        panel: '#0f141c',
        panel2: '#151c27',
        edge: '#222c3b',
        mute: '#8493a8',
        ink: '#e6edf6',
        emerald: { DEFAULT: '#2ee6a6', dim: '#0f5f47' },
        amber: { DEFAULT: '#ffb020', dim: '#6b4a07' },
        crimson: { DEFAULT: '#ff4d6a', dim: '#6b1827' },
        cyan: { DEFAULT: '#4cc9f0' },
      },
      keyframes: {
        slideIn: { from: { opacity: 0, transform: 'translateX(48px)' }, to: { opacity: 1, transform: 'none' } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'none' } },
        pulseAlert: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(255,176,32,0.55)' },
          '50%': { boxShadow: '0 0 0 8px rgba(255,176,32,0)' },
        },
        pulseBad: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(255,77,106,0.6)' },
          '50%': { boxShadow: '0 0 0 8px rgba(255,77,106,0)' },
        },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        toastIn: { from: { opacity: 0, transform: 'translateX(24px) scale(0.97)' }, to: { opacity: 1, transform: 'none' } },
        flicker: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.55 } },
      },
      animation: {
        slideIn: 'slideIn 0.35s cubic-bezier(.2,.8,.2,1) both',
        slideUp: 'slideUp 0.35s cubic-bezier(.2,.8,.2,1) both',
        pulseAlert: 'pulseAlert 1.1s ease-in-out 4',
        pulseBad: 'pulseBad 1.1s ease-in-out 4',
        marquee: 'marquee 60s linear infinite',
        toastIn: 'toastIn 0.25s ease-out both',
        flicker: 'flicker 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
