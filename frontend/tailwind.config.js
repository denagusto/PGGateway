/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // base — cool, premium neutrals
        bg: '#f5f6fb',
        surface: '#ffffff',
        line: '#e7e8f0',
        ink: '#1b1e2b',
        muted: '#6b7185',
        // brand — fresh indigo (premium fintech)
        primary: {
          DEFAULT: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
          50: '#eef2ff',
        },
        accent: '#4f46e5',
        // semantic status
        success: {
          DEFAULT: '#059669',
          bg: '#d1fae5',
        },
        warning: {
          DEFAULT: '#d97706',
          bg: '#fef3c7',
        },
        danger: {
          DEFAULT: '#dc2626',
          bg: '#fee2e2',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      fontSize: {
        // token: [size, lineHeight]
        display: ['24px', { lineHeight: '30px', fontWeight: '700' }],
        h1: ['20px', { lineHeight: '28px', fontWeight: '700' }],
        h2: ['16px', { lineHeight: '24px', fontWeight: '600' }],
        body: ['13px', { lineHeight: '20px' }],
        small: ['12px', { lineHeight: '18px' }],
        micro: ['11px', { lineHeight: '16px', fontWeight: '600' }],
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '14px',
      },
      spacing: {
        // 8px scale supplement
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
        '12': '48px',
      },
      boxShadow: {
        popover: '0 8px 24px rgba(16, 24, 40, 0.12)',
        // subtle elevation for a modern fintech surface (not flat, not heavy)
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.05)',
        'card-hover': '0 4px 14px rgba(16, 24, 40, 0.08)',
        btn: '0 1px 2px rgba(16, 24, 40, 0.08)',
      },
      keyframes: {
        'slide-fade-in': {
          '0%': { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-fade-in': 'slide-fade-in 180ms ease-out',
      },
    },
  },
  plugins: [],
}
