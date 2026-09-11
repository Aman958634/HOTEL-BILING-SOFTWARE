// Loaded only by the readiness runner. Tests may replace fetch with mocks;
// anything reaching an actual transport is restricted to local HTTP traffic.
const fetchLocal = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("Phase 4 tests block external provider network requests; use a mock.");
  return fetchLocal(input, options);
};
