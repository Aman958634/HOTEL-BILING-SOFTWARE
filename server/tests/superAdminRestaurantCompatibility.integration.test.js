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
const superAdminEmail = `super-admin-compat-${suffix}@test.invalid`;
const restaurantAdminEmail = `restaurant-admin-compat-${suffix}@test.invalid`;
const createdRestaurantIds = [];

await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

const request = (path, options = {}) => fetch(`${baseUrl}${path}`, options);
const jsonRequest = (path, token, body, method = "POST") => request(path, {
  method,
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: body === undefined ? undefined : JSON.stringify(body),
});

try {
  await User.create([
    { fullName: "Super Admin Compatibility", email: superAdminEmail, password: "SuperAdminCompat!23", role: "super_admin" },
    { fullName: "Restaurant Admin Compatibility", email: restaurantAdminEmail, password: "RestaurantAdminCompat!23", role: "admin" },
  ]);

  const login = async (email, password) => {
    const response = await request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(response.status, 200);
    return (await response.json()).data.accessToken;
  };

  const superAdminToken = await login(superAdminEmail, "SuperAdminCompat!23");
  const restaurantAdminToken = await login(restaurantAdminEmail, "RestaurantAdminCompat!23");

  const created = await jsonRequest("/super-admin/restaurants", superAdminToken, {
    name: `Compatibility Restaurant ${suffix}`,
    ownerName: "",
    adminFullName: "Created Restaurant Admin",
    adminEmail: `created-restaurant-admin-${suffix}@test.invalid`,
    phone: "",
    address: "Mumbai",
    plan: "basic",
    status: "trial",
  });
  assert.equal(created.status, 201);
  const createdPayload = await created.json();
  assert.equal(createdPayload.success, true);
  assert.equal(createdPayload.data.subscription.status, "trial");
  assert.ok(createdPayload.data.restaurant?._id);
  assert.ok(createdPayload.data.admin?._id);
  const restaurantId = createdPayload.data.restaurant._id;
  createdRestaurantIds.push(restaurantId);

  const list = await request("/super-admin/restaurants", { headers: { Authorization: `Bearer ${superAdminToken}` } });
  assert.equal(list.status, 200);
  const listPayload = await list.json();
  assert.equal(listPayload.success, true);
  assert.ok(listPayload.data.items.some((restaurant) => restaurant._id === restaurantId));

  const details = await request(`/super-admin/restaurants/${restaurantId}`, { headers: { Authorization: `Bearer ${superAdminToken}` } });
  assert.equal(details.status, 200);
  const detailsPayload = await details.json();
  assert.equal(detailsPayload.success, true);
  assert.equal(detailsPayload.data.restaurant._id, restaurantId);
  assert.ok(Object.hasOwn(detailsPayload.data, "admin"));
  assert.ok(Object.hasOwn(detailsPayload.data, "subscription"));
  assert.ok(Object.hasOwn(detailsPayload.data, "ordersCount"));
  assert.ok(Object.hasOwn(detailsPayload.data, "usersCount"));

  const updated = await jsonRequest(`/super-admin/restaurants/${restaurantId}`, superAdminToken, {
    name: `Updated Compatibility Restaurant ${suffix}`,
    phone: "9876543210",
    address: "Mumbai",
    isActive: true,
  }, "PUT");
  assert.equal(updated.status, 200);
  const updatedPayload = await updated.json();
  assert.equal(updatedPayload.success, true);
  assert.equal(updatedPayload.data.restaurant.name, `Updated Compatibility Restaurant ${suffix}`);

  const invalidId = await request("/super-admin/restaurants/not-an-object-id", { headers: { Authorization: `Bearer ${superAdminToken}` } });
  assert.equal(invalidId.status, 422);
  const invalidStatus = await jsonRequest("/super-admin/restaurants", superAdminToken, {
    name: "Invalid Status Restaurant",
    adminFullName: "Invalid Status Admin",
    adminEmail: `invalid-status-${suffix}@test.invalid`,
    status: "invalid",
  });
  assert.equal(invalidStatus.status, 422);
  const missingAddress = await jsonRequest("/super-admin/restaurants", superAdminToken, {
    name: "Missing Address Restaurant",
    adminFullName: "Missing Address Admin",
    adminEmail: `missing-address-${suffix}@test.invalid`,
    status: "trial",
  });
  assert.equal(missingAddress.status, 422);

  const forbidden = await request(`/super-admin/restaurants/${restaurantId}`, { headers: { Authorization: `Bearer ${restaurantAdminToken}` } });
  assert.equal(forbidden.status, 403);

  console.log("Super Admin restaurant compatibility integration checks passed.");
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
  await User.deleteMany({ email: { $in: [superAdminEmail, restaurantAdminEmail] } });
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
}
