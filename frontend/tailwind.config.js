/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#f1f6f2', 100: '#dfeadf', 200: '#bfd5c4', 500: '#2f6b4a', 600: '#245a3d', 700: '#1b4a32', 900: '#0f2e20' },
        gold: { 400: '#c9a95a', 500: '#b08d3c', 600: '#957430' },
        ivory: { 50: '#fbfaf6', 100: '#f6f3ea', 200: '#ece7d8' },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
