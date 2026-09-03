/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#effaf5",
          100: "#d8f2e6",
          200: "#b2e4cf",
          300: "#79d1b0",
          400: "#42b997",
          500: "#239a7b",
          600: "#187c65",
          700: "#136653",
          800: "#0f5043",
          900: "#0a3d34",
        },
      },
      boxShadow: {
        soft: "0 10px 30px rgba(18, 31, 25, 0.08)",
      },
    },
  },
  plugins: [],
};
