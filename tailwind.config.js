/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
    "./styles/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      'desktop': '768px',
    },
    extend: {
      colors: {
        'vovoh-red': '#D61F1F',
        'vovoh-gold': '#D97706',
        'vovoh-cream': '#FFFBF2',
        'vovoh-dark': '#1A1A1A',
      },
      fontFamily: {
        serif: ['Playfair Display', 'serif'],
        sans: ['Quicksand', 'sans-serif'],
      },
      borderRadius: {
        'vovoh': '2.5rem',
      },
      boxShadow: {
        'vovoh': '0 20px 50px -12px rgba(214, 31, 31, 0.15)',
      }
    },
  },
  plugins: [],
}