/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4f8f5",
          100: "#e2efe6",
          200: "#c8dfcf",
          300: "#9cc3a7",
          400: "#6ba37c",
          500: "#4d7d5f",
          600: "#3c6850",
          700: "#2f4d3f",
          800: "#243a31",
          900: "#1d2e27",
        },
      },
      boxShadow: {
        soft: "0 10px 30px rgba(18, 31, 25, 0.08)",
      },
    },
  },
  plugins: [],
};
