/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0A0A0A", // Cort Club near-black
        background: "#F5F2E8", // Warm off-white
        surface: "#FFFFFF",
        accent: "#FFE600", // Cort Club yellow
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
