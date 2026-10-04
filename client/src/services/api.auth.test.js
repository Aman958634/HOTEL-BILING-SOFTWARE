import assert from "node:assert/strict";
import test from "node:test";
import { AxiosError } from "axios";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.get(key) || null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
  clear() { this.#values.clear(); }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
const redirects = [];
globalThis.window = {
  localStorage,
  sessionStorage,
  location: { pathname: "/dashboard/admin", replace: (path) => redirects.push(path) },
  addEventListener: () => {},
  dispatchEvent: () => true,
};
globalThis.__RESTOSPHERE_PLATFORM_ENV__ = "development";
globalThis.localStorage = localStorage;
globalThis.document = {
  head: { appendChild: () => {} },
  body: { appendChild: () => {}, removeChild: () => {} },
  createElement: () => ({ style: {}, firstChild: { data: "" }, parentNode: {}, setAttribute: () => {}, appendChild: () => {}, remove: () => {} }),
  createTextNode: () => ({}),
  getElementsByTagName: () => [],
  querySelector: () => null,
};
globalThis.sessionStorage = sessionStorage;
globalThis.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };

const { default: api, refreshClient, setupAuthInterceptor } = await import("./api.js");
const { getAccessToken, persistAuthTokens } = await import("../utils/authSession.js");

const success = (config, data = { success: true }) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config,
});

const failure = (config, status, data = {}) => Promise.reject(new AxiosError(
  `HTTP ${status}`,
  "ERR_BAD_RESPONSE",
  config,
  null,
  { data, status, statusText: "Error", headers: {}, config }
));

const prepareSession = () => {
  localStorage.clear();
  sessionStorage.clear();
  redirects.length = 0;
  sessionStorage.setItem("accessToken", "expired-access");
};

const actions = [];
setupAuthInterceptor({
  dispatch: (action) => actions.push(action),
  getState: () => ({ auth: { outletStatus: "ready" } }),
});

test("one refresh renews concurrent expired requests and retries each only once", async () => {
  prepareSession();
  actions.length = 0;
  let refreshCalls = 0;
  const attempts = new Map();

  api.defaults.adapter = async (config) => {
    const key = config.url;
    attempts.set(key, (attempts.get(key) || 0) + 1);
    if (config.headers?.Authorization === "Bearer renewed-access") return success(config, { success: true, data: { key } });
    return failure(config, 401, { message: "Session expired" });
  };
  refreshClient.defaults.adapter = async (config) => {
    refreshCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return success(config, { success: true, data: { accessToken: "renewed-access" } });
  };

  const responses = await Promise.all(["a", "b", "c", "d", "e"].map((key) => api.get(`/secure/${key}`)));
  assert.equal(responses.length, 5);
  assert.equal(refreshCalls, 1);
  for (const key of ["a", "b", "c", "d", "e"]) assert.equal(attempts.get(`/secure/${key}`), 2);
  assert.equal(sessionStorage.getItem("accessToken"), "renewed-access");
  assert.equal(actions.filter((action) => action.type === "auth/logout").length, 0);
  assert.deepEqual(redirects, []);
});

test("a temporary refresh failure retains the valid local session and does not redirect", async () => {
  prepareSession();
  actions.length = 0;

  api.defaults.adapter = async (config) => failure(config, 401, { message: "Session expired" });
  refreshClient.defaults.adapter = async (config) => failure(config, 503, { message: "Temporarily unavailable" });

  await assert.rejects(() => api.get("/secure/temporary-error"));
  assert.equal(sessionStorage.getItem("accessToken"), "expired-access");
  assert.equal(actions.filter((action) => action.type === "auth/logout").length, 0);
  assert.deepEqual(redirects, []);
});
test("Remember Me controls persistent versus browser-session token storage", () => {
  localStorage.clear();
  sessionStorage.clear();

  persistAuthTokens({ accessToken: "session-access", rememberMe: false });
  assert.equal(sessionStorage.getItem("accessToken"), "session-access");
  assert.equal(localStorage.getItem("accessToken"), null);
  assert.equal(getAccessToken(), "session-access");

  persistAuthTokens({ accessToken: "persistent-access", rememberMe: true });
  assert.equal(sessionStorage.getItem("accessToken"), null);
  assert.equal(localStorage.getItem("accessToken"), "persistent-access");
  assert.equal(getAccessToken(), "persistent-access");
});