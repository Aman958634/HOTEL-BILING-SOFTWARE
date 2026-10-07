import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import mongoose from "mongoose";
import app from "../app.js";
import Log from "../models/Log.js";
import Outlet from "../models/Outlet.js";
import Restaurant from "../models/Restaurant.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import { requireSafeTestDatabase } from "./testDatabase.js";

const { uri } = requireSafeTestDatabase();
const suffix = crypto.randomBytes(8).toString("hex");
const restaurantIds = [];
const emails = [];

await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
await Outlet.init();
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

const request = (path, options = {}) => fetch(`${baseUrl}${path}`, options);
const signup = async ({ label, planName }) => {
  const email = `public-session-${label}-${suffix}@test.invalid`;
  const password = `PublicSession${label}!23`;
  emails.push(email);
  const response = await request("/public/subscribe/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      planName,
      fullName: `${label} Signup Admin`,
      ownerName: `${label} Owner`,
      email,
      password,
      phone: "9876543210",
      restaurantName: `${label} Signup Restaurant ${suffix}`,
      address: "Local test address",
      city: "Mumbai",
    }),
  });
  assert.equal(response.status, 201);
  const payload = (await response.json()).data;
  restaurantIds.push(payload.restaurant._id);
  return { email, password, payload };
};

const assertFirstSession = async ({ payload, expectedPlan }) => {
  assert.equal(payload.subscription.planName, expectedPlan);
  const trialStart = new Date(payload.subscription.trialStartAt || payload.subscription.trialStartDate);
  const trialEnd = new Date(payload.subscription.trialEndAt || payload.subscription.trialEndDate);
  assert.equal(payload.subscription.status, "trial");
  assert.equal(trialEnd.getTime() - trialStart.getTime(), 7 * 24 * 60 * 60 * 1000, "new signup trial is exactly seven days");
  assert.equal(payload.subscription.trialLabel, "7-Day Free Trial");
  assert.equal(payload.authorizedOutlets.length, 1, "first session returns exactly one authorized Main Outlet");
  const outlet = payload.authorizedOutlets[0];
  assert.equal(outlet.name, "Main Outlet");
  assert.equal(outlet.isActive, true);
  assert.equal(outlet.isDefault, true);
  assert.equal(String(outlet.restaurant), String(payload.restaurant._id));
  assert.equal(String(payload.user.defaultOutlet), String(outlet._id));
  assert.ok(payload.user.outletAccess.some((entry) => String(entry.outlet) === String(outlet._id) && entry.isActive !== false));

  // This uses the outlet ID returned by the authenticated server session, as
  // the client does after applyOutletSession(), not a client-created ID.
  const active = await request("/outlets/active", {
    headers: { Authorization: `Bearer ${payload.accessToken}`, "X-Outlet-Id": String(outlet._id) },
  });
  assert.equal(active.status, 200, "first-session outlet context is immediately authorized");
  return outlet;
};

try {
  const trial = await signup({ label: "Trial", planName: "trial" });
  const trialOutlet = await assertFirstSession({ payload: trial.payload, expectedPlan: "basic" });

  const paid = await signup({ label: "Paid", planName: "basic" });
  const paidOutlet = await assertFirstSession({ payload: paid.payload, expectedPlan: "basic" });
  assert.notEqual(String(trialOutlet.restaurant), String(paidOutlet.restaurant));

  const foreignOutlet = await request("/outlets/active", {
    headers: { Authorization: `Bearer ${trial.payload.accessToken}`, "X-Outlet-Id": String(paidOutlet._id) },
  });
  assert.equal(foreignOutlet.status, 403, "a signup session cannot use another restaurant's outlet");

  const freshLogin = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: trial.email, password: trial.password }),
  });
  assert.equal(freshLogin.status, 200);
  const freshPayload = (await freshLogin.json()).data;
  assert.equal(freshPayload.authorizedOutlets.length, 1, "normal login continues to return Main Outlet");
  assert.equal(String(freshPayload.authorizedOutlets[0]._id), String(trialOutlet._id));

  console.log("Public subscription first-session integration checks passed.");
} finally {
  if (restaurantIds.length) {
    await Promise.all([
      Outlet.deleteMany({ restaurant: { $in: restaurantIds } }),
      Subscription.deleteMany({ restaurant: { $in: restaurantIds } }),
      User.deleteMany({ restaurant: { $in: restaurantIds } }),
      Log.deleteMany({ "context.restaurantId": { $in: restaurantIds } }),
      Restaurant.deleteMany({ _id: { $in: restaurantIds } }),
    ]);
  }
  if (emails.length) await User.deleteMany({ email: { $in: emails } });
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
}
