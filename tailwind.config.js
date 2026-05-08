/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Premium minimal SlimDose Theme — White / Cream / Blue accent
        'theme-bg': '#FFFFFF',          // Main: White
        'theme-sub': '#FFFCF6',         // Sub: Cream
        'theme-text': '#1A1A1A',        // Soft Black
        'theme-accent': '#3C6CA8',      // Blue accent
        'theme-secondary': '#FFFCF6',   // Cream

        // Backwards-compatible mappings — all remapped onto the premium palette
        primary: {
          50: '#FFFFFF',
          100: '#FFFCF6',
          200: '#FBF6EA',
          300: '#E2EBF5',
          400: '#94B3D6',
          500: '#3C6CA8',
          600: '#315A8E',
          700: '#264874',
          800: '#1C375A',
          900: '#132843',
        },
        // Old "gold" tokens remapped to cream/blue so legacy classes don't break the look
        gold: {
          50: '#FFFDFA',
          100: '#FFFCF6',
          200: '#FBF6EA',
          300: '#E2EBF5',
          400: '#94B3D6',
          500: '#3C6CA8',
          600: '#315A8E',
          700: '#264874',
          800: '#1C375A',
          900: '#132843',
        },
        accent: {
          light: '#FFFCF6',
          DEFAULT: '#3C6CA8',
          dark: '#264874',
          white: '#FFFFFF',
          black: '#1A1A1A',
          navy: '#3C6CA8',
        },
        // Old "navy-*" tokens remapped to the blue accent scale
        navy: {
          50: '#F2F6FB',
          100: '#E2EBF5',
          200: '#C2D4EA',
          300: '#94B3D6',
          400: '#6691C2',
          500: '#3C6CA8',
          600: '#315A8E',
          700: '#264874',
          800: '#1C375A',
          900: '#132843',
        },
        cream: {
          DEFAULT: '#FFFCF6',
          50: '#FFFDFA',
          100: '#FFFCF6',
          200: '#FBF6EA',
        },
        brand: {
          DEFAULT: '#3C6CA8',
          50: '#F2F6FB',
          100: '#E2EBF5',
          200: '#C2D4EA',
          300: '#94B3D6',
          400: '#6691C2',
          500: '#3C6CA8',
          600: '#315A8E',
          700: '#264874',
          800: '#1C375A',
          900: '#132843',
        },
        charcoal: {
          DEFAULT: '#1A1A1A',
          50: '#F7F7F7',
          100: '#EFEFEF',
          200: '#DCDCDC',
          300: '#BFBFBF',
          400: '#8A8A8A',
          500: '#5C5C5C',
          600: '#3D3D3D',
          700: '#2A2A2A',
          800: '#1F1F1F',
          900: '#1A1A1A',
        },
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        heading: ['Playfair Display', 'serif'],
        cute: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 12px rgba(20, 35, 60, 0.05), 0 1px 4px rgba(20, 35, 60, 0.03)',
        'medium': '0 4px 15px rgba(20, 35, 60, 0.06)',
        'hover': '0 8px 25px rgba(20, 35, 60, 0.08)',
        'luxury': '0 12px 32px rgba(60, 108, 168, 0.10), 0 4px 12px rgba(60, 108, 168, 0.05)',
      },
      animation: {
        'fadeIn': 'fadeIn 0.5s ease-out',
        'slideIn': 'slideIn 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
