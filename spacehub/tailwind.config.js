/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c2d4ff',
          300: '#94b3ff',
          400: '#5f87ff',
          500: '#3b63f5',
          600: '#2745d9',
          700: '#2037b0',
          800: '#1f328c',
          900: '#1e2e6e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
