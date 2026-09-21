/* global self */
// Workbox generates the service worker. This small bridge deliberately owns
// only the explicit, app-approved activation message; it does not alter
// install prompts, API caching, or runtime payment behavior.
self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "RESTOSPHERE_SKIP_WAITING") {
    self.skipWaiting();
  }
});
