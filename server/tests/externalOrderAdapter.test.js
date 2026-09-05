import assert from "node:assert/strict";
import test from "node:test";
import { EXTERNAL_PROVIDERS, getExternalOrderAdapter, getExternalOrderIntegrationStatus, normalizeExternalOrder } from "../services/externalOrderAdapter.js";

test("external order architecture reports provider access as required", () => {
  assert.deepEqual(EXTERNAL_PROVIDERS, []);
  assert.equal(getExternalOrderIntegrationStatus().status, "Provider access required");
  assert.equal(getExternalOrderIntegrationStatus().webhook, "Not implemented - provider specification required");
});

test("unsupported external providers fail before any order mutation", () => {
  assert.throws(() => getExternalOrderAdapter("zomato"), /not configured/);
  assert.throws(() => normalizeExternalOrder({}), /requires a provider adapter/);
});
