import { generateSW } from "workbox-build";
import { resolve } from "node:path";

const dist = resolve("dist");
const result = await generateSW({
  globDirectory: dist,
  globPatterns: ["**/*.{html,js,css,svg,png,webmanifest}"],
  globIgnores: ["sw.js", "workbox-*.js"],
  swDest: resolve(dist, "sw.js"),
  cleanupOutdatedCaches: true,
  clientsClaim: false,
  skipWaiting: false,
  navigateFallback: "/index.html",
  navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /^\/socket\.io\//],
  runtimeCaching: [],
});

console.log(`PWA service worker generated: ${result.count} static assets (${result.size} bytes).`);