/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101828',
        navy: '#111927',
        gold: { DEFAULT: '#C7A44B', soft: '#F8F0D8', dark: '#92752F' },
        canvas: '#F5F6F8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      boxShadow: { card: '0 14px 40px rgba(15,23,42,.07)' },
    },
  },
  plugins: [],
};
