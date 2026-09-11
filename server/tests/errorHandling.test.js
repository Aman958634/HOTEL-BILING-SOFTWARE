import assert from "node:assert/strict";
import { errorHandler } from "../middleware/errorHandler.js";

let body;
const response = { status(code) { this.code = code; return this; }, json(value) { body = value; return this; } };
errorHandler(new Error("provider secret=do-not-return mongodb://user:pass@host/db /srv/app/index.js"), { requestId: "phase5", method: "GET", originalUrl: "/private" }, response, () => {});
assert.equal(response.code, 500);
assert.equal(body.message, "Internal server error");
assert.doesNotMatch(JSON.stringify(body), /do-not-return|mongodb|srv\/app|stack/i);
console.log("errorHandling.test.js passed: production error response is generic and non-sensitive.");
