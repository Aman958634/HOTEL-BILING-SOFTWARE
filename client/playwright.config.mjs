import { defineConfig, devices } from "@playwright/test";

const externalServers = process.env.PLAYWRIGHT_EXTERNAL_SERVERS === "1";
const apiPort = process.env.PLAYWRIGHT_API_PORT || "5003";
const appPort = process.env.PLAYWRIGHT_APP_PORT || "5174";
const apiUrl = `http://127.0.0.1:${apiPort}`;
const appUrl = `http://127.0.0.1:${appPort}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: process.env.PLAYWRIGHT_PARALLEL === "1",
  retries: 0,
  use: {
    baseURL: appUrl,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // The release harness can attach to explicitly started local test servers.
  // This avoids Windows child-process teardown from masking a completed test run.
  webServer: externalServers ? undefined : [
    {
      cwd: "../server",
      command: `set PORT=${apiPort}&& node scripts/browserRoleMatrixFixture.mjs && node scripts/startBrowserTestServer.mjs`,
      url: `${apiUrl}/api/v1/ready`,
      reuseExistingServer: true,
      timeout: 45_000,
    },
    {
      command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${appPort} --strictPort`,
      env: {
        VITE_API_URL: `${apiUrl}/api/v1`,
        VITE_SOCKET_URL: apiUrl,
      },
      url: appUrl,
      // Reuse only the local test Vite server when the runner is invoked
      // repeatedly for independent release-gate scenarios.
      reuseExistingServer: true,
      timeout: 45_000,
    },
  ],
});
