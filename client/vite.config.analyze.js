import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { writeFileSync } from "node:fs";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "report-json",
      generateBundle(_, bundle) {
        const path = "dist";
        writeFileSync(`${path}/report.json`, JSON.stringify(bundle, null, 2));
      },
    },
  ],
  server: { port: 5173 },
  build: {
  },
});
