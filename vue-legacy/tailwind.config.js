/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
    "./public/**/*.html"
  ],
  theme: {
    extend: {
      letterSpacing: {
        'extra-wide': '1em',
        'ultra-wide': '1.5em',
        'mega-wide': '2em'
      }
    },
  },
  plugins: [],
} 