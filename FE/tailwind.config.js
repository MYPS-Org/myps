/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: false, // Disable dark mode completely
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '0.75rem',   // 12px → matches 13px base font
        sm: '1rem',           // 16px
        lg: '1.5rem',         // 24px
        xl: '2rem',           // 32px
        '2xl': '2.5rem',      // 40px
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1440px',
      },
    },
    extend: {
      colors: {
        // Custom color palette that works well in both themes
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          150: '#edeef0',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          850: '#1a202c',
          900: '#111827',
          950: '#0d1117',
        }
      },
      transitionProperty: {
        'colors': 'color, background-color, border-color, text-decoration-color, fill, stroke',
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],      // 12px
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
        'base': ['0.875rem', { lineHeight: '1.5rem' }], // 14px (reduced from 16px)
        'lg': ['1rem', { lineHeight: '1.5rem' }],       // 16px
        'xl': ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
        '2xl': ['1.25rem', { lineHeight: '1.75rem' }],  // 20px
        '3xl': ['1.5rem', { lineHeight: '2rem' }],      // 24px
        '4xl': ['1.75rem', { lineHeight: '2.25rem' }],  // 28px
        '5xl': ['2rem', { lineHeight: '2.5rem' }],      // 32px
      },
      spacing: {
        '128': '32rem',
        '144': '36rem',
      },
    },
  },
  plugins: [],
}
