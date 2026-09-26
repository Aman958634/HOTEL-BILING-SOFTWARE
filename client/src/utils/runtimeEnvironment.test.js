import assert from "node:assert/strict";
import test from "node:test";
import { resolveFrontendRuntimeConfig } from "./runtimeEnvironment.js";

const staging = (overrides = {}) => ({
  apiUrl: "https://staging-api.example.test/api/v1",
  socketUrl: "https://staging-api.example.test",
  deploymentEnvironment: "staging",
  platformEnvironment: "preview",
  stagingApiHosts: "staging-api.example.test",
  isProduction: true,
  isDevelopment: false,
  ...overrides,
});

test("staging requires an explicit API URL", () => {
  assert.throws(() => resolveFrontendRuntimeConfig(staging({ apiUrl: "" })), /VITE_API_URL is required/);
});

test("staging rejects production API fallback", () => {
  assert.throws(() => resolveFrontendRuntimeConfig(staging({ apiUrl: "https://hotel-biling-software.onrender.com/api/v1" })), /cannot use the production API host/);
});

test("staging rejects production Socket.IO fallback", () => {
  assert.throws(() => resolveFrontendRuntimeConfig(staging({ socketUrl: "https://hotel-biling-software.onrender.com" })), /cannot use the production API host/);
});

test("staging rejects the production host even when it is allowlisted", () => {
  assert.throws(() => resolveFrontendRuntimeConfig(staging({
    stagingApiHosts: "staging-api.example.test,hotel-biling-software.onrender.com",
  })), /must not contain a production API host/);
});

test("staging rejects HTTP endpoints", () => {
  assert.throws(() => resolveFrontendRuntimeConfig(staging({ apiUrl: "http://staging-api.example.test/api/v1" })), /must be an HTTPS URL/);
});

test("staging accepts explicit approved HTTPS API and Socket.IO endpoints", () => {
  assert.deepEqual(resolveFrontendRuntimeConfig(staging()), {
    apiUrl: "https://staging-api.example.test/api/v1",
    socketUrl: "https://staging-api.example.test",
  });
});

test("existing production configuration remains compatible", () => {
  assert.deepEqual(resolveFrontendRuntimeConfig({
    apiUrl: "https://production-api.example.test/api/v1",
    socketUrl: "https://production-api.example.test",
    deploymentEnvironment: "production",
    platformEnvironment: "production",
    stagingApiHosts: "",
    isProduction: true,
    isDevelopment: false,
  }), {
    apiUrl: "https://production-api.example.test/api/v1",
    socketUrl: "https://production-api.example.test",
  });
});
