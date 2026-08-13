/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          500: "#0891b2",
          700: "#0f766e",
          900: "#134e4a"
        }
      },
      boxShadow: {
        glass: "0 10px 30px rgba(15, 23, 42, 0.15)",
      },
    },
  },
  plugins: [],
};
