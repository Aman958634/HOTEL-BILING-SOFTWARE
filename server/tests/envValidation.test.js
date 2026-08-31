import assert from "node:assert/strict";
import { validateProductionEnvironment } from "../config/envValidation.js";

const names = ["NODE_ENV", "MONGO_URI", "MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "CLIENT_URL", "PUBLIC_MENU_ENABLED", "LIVE_DIGITAL_PAYMENTS"];
const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));

try {
  process.env.NODE_ENV = "production";
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
  process.env.CLIENT_URL = "https://example.test";
  process.env.PUBLIC_MENU_ENABLED = "false";
  process.env.LIVE_DIGITAL_PAYMENTS = "false";

  delete process.env.MONGO_URI;
  delete process.env.MONGODB_URI;
  assert.throws(() => validateProductionEnvironment(), /MONGO_URI or MONGODB_URI/);

  process.env.MONGO_URI = "mongodb://127.0.0.1:27017/restosphere_verification";
  assert.throws(() => validateProductionEnvironment(), /must not target localhost/);

  process.env.MONGO_URI = "mongodb+srv://cluster.example.test/restosphere_verification";
  assert.doesNotThrow(() => validateProductionEnvironment());
  console.log("Production MongoDB environment validation tests passed.");
} finally {
  for (const [name, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
