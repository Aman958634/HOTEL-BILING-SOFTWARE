/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          500: "#10b981",
          700: "#059669",
          900: "#064e3b"
        }
      },
      boxShadow: {
        glass: "0 10px 30px rgba(15, 23, 42, 0.15)",
      },
    },
  },
  plugins: [],
};
