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
import { ensureProvisionedMainOutlet, MAIN_OUTLET_CODE, provisionRestaurantWithAdmin } from "../services/restaurantProvisioningService.js";
import { requireSafeTestDatabase } from "./testDatabase.js";

const { uri } = requireSafeTestDatabase();
const suffix = crypto.randomBytes(8).toString("hex");
const createdRestaurantIds = [];
const createdEmails = [];

await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
await Outlet.init();
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

const request = (path, options = {}) => fetch(`${baseUrl}${path}`, options);
const login = async (email, password) => {
  const response = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  return (await response.json()).data;
};

try {
  const superAdminEmail = `provision-super-${suffix}@test.invalid`;
  const adminEmail = `provision-admin-${suffix}@test.invalid`;
  const adminPassword = "ProvisionedAdmin!23";
  createdEmails.push(superAdminEmail, adminEmail);
  await User.create({ fullName: "Provisioning Super Admin", email: superAdminEmail, password: "ProvisioningSuper!23", role: "super_admin" });

  const superSession = await login(superAdminEmail, "ProvisioningSuper!23");
  const created = await request("/super-admin/restaurants", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${superSession.accessToken}` },
    body: JSON.stringify({
      name: `Provisioned Restaurant ${suffix}`,
      adminFullName: "Provisioned Restaurant Admin",
      adminEmail,
      password: adminPassword,
      phone: "9876543210",
      address: "Local test address",
      city: "Mumbai",
      plan: "basic",
      status: "trial",
    }),
  });
  assert.equal(created.status, 201);
  const createdPayload = await created.json();
  const restaurantId = createdPayload.data.restaurant._id;
  const adminId = createdPayload.data.admin._id;
  createdRestaurantIds.push(restaurantId);

  const mainOutlets = await Outlet.find({ restaurant: restaurantId, code: MAIN_OUTLET_CODE }).lean();
  assert.equal(mainOutlets.length, 1, "new restaurant has exactly one Main Outlet");
  const mainOutlet = mainOutlets[0];
  assert.equal(mainOutlet.name, "Main Outlet");
  assert.equal(mainOutlet.isActive, true);
  assert.equal(mainOutlet.isDefault, true);
  assert.equal(String(mainOutlet.restaurant), String(restaurantId));

  const admin = await User.findById(adminId).lean();
  assert.equal(String(admin.restaurant), String(restaurantId));
  assert.equal(String(admin.defaultOutlet), String(mainOutlet._id));
  assert.deepEqual(
    admin.outletAccess.map((entry) => ({ outlet: String(entry.outlet), role: entry.role, isActive: entry.isActive })),
    [{ outlet: String(mainOutlet._id), role: "admin", isActive: true }]
  );

  const adminSession = await login(adminEmail, adminPassword);
  assert.equal(String(adminSession.user.defaultOutlet), String(mainOutlet._id));
  assert.equal(adminSession.authorizedOutlets.length, 1);
  assert.equal(String(adminSession.authorizedOutlets[0]._id), String(mainOutlet._id));

  const foreignRestaurant = await Restaurant.create({
    name: `Foreign Provisioning Restaurant ${suffix}`,
    slug: `foreign-provisioning-${suffix}`,
    branchCode: `FP${suffix.slice(-6)}`,
    address: "Local test address",
  });
  createdRestaurantIds.push(foreignRestaurant._id);
  const foreignOutlet = await Outlet.create({ restaurant: foreignRestaurant._id, name: "Foreign Outlet", code: `FOREIGN${suffix.slice(-6)}`, isActive: true, isDefault: true });
  const forgedOutletRequest = await request("/outlets/active", {
    headers: { Authorization: `Bearer ${adminSession.accessToken}`, "X-Outlet-Id": String(foreignOutlet._id) },
  });
  assert.equal(forgedOutletRequest.status, 403, "provisioned admin cannot select another restaurant's outlet");

  const staffEmail = `provision-staff-${suffix}@test.invalid`;
  createdEmails.push(staffEmail);
  await User.create({ fullName: "Unassigned Provisioning Staff", email: staffEmail, password: "ProvisioningStaff!23", role: "staff", restaurant: restaurantId });
  const staffSession = await login(staffEmail, "ProvisioningStaff!23");
  assert.equal(staffSession.authorizedOutlets.length, 0, "staff remains unassigned without explicit outlet access");

  const superOutlets = await request("/outlets/me", { headers: { Authorization: `Bearer ${superSession.accessToken}` } });
  assert.equal(superOutlets.status, 200);
  assert.deepEqual((await superOutlets.json()).data, [], "super admin retains no operational outlet context");

  const rollbackEmail = `provision-rollback-${suffix}@test.invalid`;
  createdEmails.push(rollbackEmail);
  const rollbackRestaurantId = new mongoose.Types.ObjectId();
  const rollbackRestaurantEmail = `provision-rollback-restaurant-${suffix}@test.invalid`;
  await assert.rejects(
    provisionRestaurantWithAdmin({
      restaurantInput: {
        _id: rollbackRestaurantId,
        name: `Rollback Provisioning Restaurant ${suffix}`,
        branchCode: `RB${suffix.slice(-6)}`,
        email: rollbackRestaurantEmail,
        address: "Local test address",
      },
      adminInput: { fullName: "Rollback Admin", email: rollbackEmail, password: "RollbackAdmin!23", role: "admin" },
      subscriptionInput: { planName: "basic", billingCycle: "not-a-valid-cycle", status: "trial", startDate: new Date() },
    })
  );
  assert.equal(await Restaurant.countDocuments({ _id: rollbackRestaurantId }), 0, "required-step failure rolls back restaurant");
  assert.equal(await Outlet.countDocuments({ restaurant: rollbackRestaurantId }), 0, "required-step failure rolls back Main Outlet");
  assert.equal(await User.countDocuments({ email: rollbackEmail }), 0, "required-step failure rolls back admin");
  assert.equal(await Subscription.countDocuments({ restaurant: rollbackRestaurantId }), 0, "required-step failure rolls back subscription");

  const concurrencyRestaurant = await Restaurant.create({
    name: `Concurrency Provisioning Restaurant ${suffix}`,
    slug: `concurrency-provisioning-${suffix}`,
    branchCode: `CP${suffix.slice(-6)}`,
    address: "Local test address",
  });
  createdRestaurantIds.push(concurrencyRestaurant._id);
  const concurrentOutlets = await Promise.all([
    ensureProvisionedMainOutlet(concurrencyRestaurant),
    ensureProvisionedMainOutlet(concurrencyRestaurant),
  ]);
  assert.equal(String(concurrentOutlets[0]._id), String(concurrentOutlets[1]._id));
  assert.equal(await Outlet.countDocuments({ restaurant: concurrencyRestaurant._id, code: MAIN_OUTLET_CODE }), 1, "concurrent Main Outlet provisioning is idempotent");

  console.log("Restaurant provisioning integration checks passed.");
} finally {
  if (createdRestaurantIds.length) {
    await Promise.all([
      Outlet.deleteMany({ restaurant: { $in: createdRestaurantIds } }),
      Subscription.deleteMany({ restaurant: { $in: createdRestaurantIds } }),
      User.deleteMany({ restaurant: { $in: createdRestaurantIds } }),
      Log.deleteMany({ "context.restaurantId": { $in: createdRestaurantIds } }),
      Restaurant.deleteMany({ _id: { $in: createdRestaurantIds } }),
    ]);
  }
  if (createdEmails.length) await User.deleteMany({ email: { $in: createdEmails } });
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
}