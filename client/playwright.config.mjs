import { defineConfig, devices } from "@playwright/test";

const externalServers = process.env.PLAYWRIGHT_EXTERNAL_SERVERS === "1";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: process.env.PLAYWRIGHT_PARALLEL === "1",
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // The release harness can attach to explicitly started local test servers.
  // This avoids Windows child-process teardown from masking a completed test run.
  webServer: externalServers ? undefined : [
    {
      cwd: "../server",
      command: "set PORT=5003&& node scripts/browserRoleMatrixFixture.mjs && node scripts/startBrowserTestServer.mjs",
      url: "http://127.0.0.1:5003/api/v1/ready",
      reuseExistingServer: true,
      timeout: 45_000,
    },
    {
      command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174",
      env: {
        VITE_API_URL: "http://127.0.0.1:5003/api/v1",
        VITE_SOCKET_URL: "http://127.0.0.1:5003",
      },
      url: "http://127.0.0.1:5174",
      // Reuse only the local test Vite server when the runner is invoked
      // repeatedly for independent release-gate scenarios.
      reuseExistingServer: true,
      timeout: 45_000,
    },
  ],
});
