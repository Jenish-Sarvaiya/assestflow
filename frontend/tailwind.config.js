/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      spacing: {
        4.5: '1.125rem',
      },
      colors: {
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#ff5a1f',
          600: '#ea3e0b',
          700: '#c73508',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        slate: {
          350: '#334155',
          450: '#526173',
          550: '#748094',
          650: '#aab6c5',
          750: '#ccd6e2',
          850: '#edf2f7',
        },
        teal: {
          450: '#0f8a9a',
        },
        emerald: {
          450: '#047857',
        },
        red: {
          650: '#dc2626',
        },
        coral: {
          400: '#fb7185',
          500: '#f43f5e',
        },
      },
    },
  },
  plugins: [],
}
