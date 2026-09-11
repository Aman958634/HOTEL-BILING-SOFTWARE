import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Vite's production mode must always use React's production runtime. Some
  // local shells set NODE_ENV=development globally; without this guard, that
  // environment leaks development diagnostics into an otherwise production
  // bundle.
  if (mode === "production") process.env.NODE_ENV = "production";

  const env = loadEnv(mode, process.cwd(), "VITE_");
  const isLocalUrl = (url) => /(^|\/\/)(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url || "");
  const isHttpsUrl = (url) => /^https:\/\/[^/]+/i.test(url || "");
  if (mode === "production" && (!env.VITE_API_URL || !env.VITE_SOCKET_URL || isLocalUrl(env.VITE_API_URL) || isLocalUrl(env.VITE_SOCKET_URL) || !isHttpsUrl(env.VITE_API_URL) || !isHttpsUrl(env.VITE_SOCKET_URL))) {
    throw new Error("Production frontend configuration requires VITE_API_URL and VITE_SOCKET_URL.");
  }

  return {
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    target: "es2015",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          redux: ["@reduxjs/toolkit", "react-redux"],
          vendor: ["axios"],
          charts: ["recharts"],
          socket: ["socket.io-client"],
        },
      },
    },
  },
  };
});
