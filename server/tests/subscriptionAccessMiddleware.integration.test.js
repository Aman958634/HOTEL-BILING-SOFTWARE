import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { requireSafeTestDatabase } from "./testDatabase.js";
import Restaurant from "../models/Restaurant.js";
import Subscription from "../models/Subscription.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";

const { uri } = requireSafeTestDatabase();
const suffix = crypto.randomBytes(7).toString("hex");
const created = [];
const invoke = async (user) => new Promise((resolve, reject) => {
  const req = { user };
  requireActiveSubscription(req, {}, (error) => resolve({ error, req })).catch(reject);
});

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const restaurant = await Restaurant.create({ name: `Entitlement ${suffix}`, slug: `entitlement-${suffix}`, branchCode: `E${suffix.slice(0, 6)}`, address: "Isolated test" });
  created.push(restaurant._id);
  const expired = await Subscription.create({ restaurant: restaurant._id, planName: "basic", status: "trial", trialStartDate: new Date(Date.now() - 8 * 86400000), trialEndDate: new Date(Date.now() - 86400000), metadata: { trialDurationDays: 7 } });
  const denied = await invoke({ _id: new mongoose.Types.ObjectId(), role: "manager", restaurant: restaurant._id });
  assert.equal(denied.error?.statusCode, 403);
  assert.equal(denied.error?.code, "SUBSCRIPTION_EXPIRED");
  assert.equal(denied.error?.details?.subscriptionState, "TRIAL_EXPIRED");
  assert.equal((await Subscription.findById(expired._id)).status, "expired");

  const active = await Subscription.create({ restaurant: restaurant._id, planName: "basic", status: "active", subscriptionStartAt: new Date(), subscriptionEndAt: new Date(Date.now() + 86400000), renewalDate: new Date(Date.now() + 86400000), metadata: {} });
  const allowed = await invoke({ _id: new mongoose.Types.ObjectId(), role: "manager", restaurant: restaurant._id });
  assert.equal(allowed.error, undefined);
  assert.equal(allowed.req.subscription._id.toString(), active._id.toString());

  const operator = await invoke({ _id: new mongoose.Types.ObjectId(), role: "super_admin" });
  assert.equal(operator.error, undefined);
  console.log("subscriptionAccessMiddleware.integration.test.js passed: expired tenant denied, active tenant allowed, super admin bypass preserved.");
} finally {
  if (mongoose.connection.readyState === 1) {
    await Subscription.deleteMany({ restaurant: { $in: created } });
    await Restaurant.deleteMany({ _id: { $in: created } });
    await mongoose.disconnect();
  }
}
