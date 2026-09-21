import { generateSW } from "workbox-build";
import { resolve } from "node:path";

const dist = resolve("dist");
const result = await generateSW({
  globDirectory: dist,
  globPatterns: ["**/*.{html,js,css,svg,png,webmanifest}"],
  globIgnores: ["sw.js", "workbox-*.js"],
  swDest: resolve(dist, "sw.js"),
  cleanupOutdatedCaches: true,
  // Activation is explicitly requested by the registration code only after it
  // confirms that no checkout or payment return flow is active.
  clientsClaim: true,
  skipWaiting: false,
  importScripts: ["/pwa-update-bridge.js"],
  // index.html remains a versioned precache entry solely as the offline app
  // shell. New workers are checked without HTTP-cache reuse and replace that
  // entry before a controlled reload, so an old HTML shell cannot persist
  // across a normal deployment.
  navigateFallback: "/index.html",
  navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /^\/socket\.io\//, /^\/webhooks?\//],
  runtimeCaching: [],
});

console.log(`PWA service worker generated: ${result.count} static assets (${result.size} bytes).`);
