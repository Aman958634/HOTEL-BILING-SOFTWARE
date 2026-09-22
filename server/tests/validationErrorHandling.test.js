import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { body } from "express-validator";
import { errorHandler } from "../middleware/errorHandler.js";
import { validate } from "../middleware/validate.js";

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.requestId = "validation-test";
  next();
});
app.post(
  "/validation",
  [body("email").isEmail().withMessage("Enter a valid email address.")],
  validate,
  (_req, res) => res.status(204).end()
);
app.post("/mongoose-validation", (_req, _res, next) => {
  next({
    name: "ValidationError",
    errors: {
      fullName: { kind: "required" },
      email: { kind: "user defined" },
    },
  });
});
app.use(errorHandler);

const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/validation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "not-an-email" }),
  });
  const payload = await response.json();
  assert.equal(response.status, 422);
  assert.equal(payload.code, "VALIDATION_ERROR");
  assert.equal(payload.errors.email, "Enter a valid email address.");
  assert.equal(payload.details.fields.email, "Enter a valid email address.");

  const mongooseResponse = await fetch(`http://127.0.0.1:${port}/mongoose-validation`, { method: "POST" });
  const mongoosePayload = await mongooseResponse.json();
  assert.equal(mongooseResponse.status, 422);
  assert.equal(mongoosePayload.errors.fullName, "Full Name is required.");
  assert.equal(mongoosePayload.errors.email, "Enter a valid value.");
  console.log("Validation error handling checks passed.");
} finally {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
