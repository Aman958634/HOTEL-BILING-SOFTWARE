import { requireSafeTestDatabase } from "../tests/testDatabase.js";

// Validate before importing the server (and before it can open MongoDB).
requireSafeTestDatabase();

// Browser E2E runs only against the explicitly configured isolated test URI.
process.env.NODE_ENV = "development";
process.env.LOAD_TEST_MODE = "true";
process.env.LOAD_TEST_PROFILE = "false";
process.env.PORT ||= "5003";
process.env.LIVE_DIGITAL_PAYMENTS = "false";
process.env.SUPER_ADMIN_SEED = "false";

await import("../server.js");
