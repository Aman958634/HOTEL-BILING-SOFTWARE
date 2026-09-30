import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import mongoose from "mongoose";
import app from "../app.js";
import Bill from "../models/Bill.js";
import HotelPaymentSettings from "../models/HotelPaymentSettings.js";
import Invoice from "../models/Invoice.js";
import Log from "../models/Log.js";
import Order from "../models/Order.js";
import Outlet from "../models/Outlet.js";
import Payment from "../models/Payment.js";
import Restaurant from "../models/Restaurant.js";
import User from "../models/User.js";
import { requireSafeTestDatabase } from "./testDatabase.js";

const { uri } = requireSafeTestDatabase();
const suffix = crypto.randomBytes(8).toString("hex");
const createdRestaurantIds = [];
const createdEmails = [];

await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
const request = (path, options = {}) => fetch(`${baseUrl}${path}`, options);

const loginResponse = (email, password) => request("/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});

const login = async (email, password) => {
  const response = await loginResponse(email, password);
  assert.equal(response.status, 200, `Expected active user ${email} to log in`);
  return (await response.json()).data;
};

const authHeaders = (accessToken, extra = {}) => ({ Authorization: `Bearer ${accessToken}`, ...extra });

try {
  const password = "RestaurantAccount!23";
  const superEmail = `account-super-${suffix}@test.invalid`;
  const adminAEmail = `account-admin-a-${suffix}@test.invalid`;
  const staffAEmail = `account-staff-a-${suffix}@test.invalid`;
  const adminBEmail = `account-admin-b-${suffix}@test.invalid`;
  createdEmails.push(superEmail, adminAEmail, staffAEmail, adminBEmail);

  const [restaurantA, restaurantB] = await Restaurant.create([
    { name: `Account Tenant A ${suffix}`, slug: `account-a-${suffix}`, branchCode: `AA${suffix.slice(-6)}`, address: "Local test address", isActive: true },
    { name: `Account Tenant B ${suffix}`, slug: `account-b-${suffix}`, branchCode: `AB${suffix.slice(-6)}`, address: "Local test address", isActive: true },
  ]);
  createdRestaurantIds.push(restaurantA._id, restaurantB._id);

  const [outletA, outletB] = await Outlet.create([
    { restaurant: restaurantA._id, name: "Main Outlet", code: `A${suffix.slice(-8)}`, isDefault: true, isActive: true },
    { restaurant: restaurantB._id, name: "Main Outlet", code: `B${suffix.slice(-8)}`, isDefault: true, isActive: true },
  ]);

  await User.create([
    { fullName: "Lifecycle Super Admin", email: superEmail, password, role: "super_admin" },
    { fullName: "Lifecycle Admin A", email: adminAEmail, password, role: "admin", restaurant: restaurantA._id, defaultOutlet: outletA._id, outletAccess: [{ outlet: outletA._id, role: "admin", isActive: true }] },
    { fullName: "Lifecycle Staff A", email: staffAEmail, password, role: "staff", restaurant: restaurantA._id, defaultOutlet: outletA._id, outletAccess: [{ outlet: outletA._id, role: "staff", isActive: true }] },
    { fullName: "Lifecycle Admin B", email: adminBEmail, password, role: "admin", restaurant: restaurantB._id, defaultOutlet: outletB._id, outletAccess: [{ outlet: outletB._id, role: "admin", isActive: true }] },
  ]);

  const [superSession, adminASession, staffASession, adminBSession] = await Promise.all([
    login(superEmail, password),
    login(adminAEmail, password),
    login(staffAEmail, password),
    login(adminBEmail, password),
  ]);

  assert.equal((await request("/outlets/me", { headers: authHeaders(adminASession.accessToken) })).status, 200);
  assert.equal((await request("/outlets/me", { headers: authHeaders(staffASession.accessToken) })).status, 200);

  const suspend = await request(`/super-admin/restaurants/${restaurantA._id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(superSession.accessToken) },
    body: JSON.stringify({ status: "suspended" }),
  });
  assert.equal(suspend.status, 200);
  assert.equal((await Restaurant.findById(restaurantA._id).lean()).isActive, false);
  assert.equal((await User.findOne({ email: adminAEmail }).lean()).refreshToken, "", "suspending clears only tenant A refresh tokens");
  assert.equal((await User.findOne({ email: adminBEmail }).lean()).refreshToken, adminBSession.refreshToken, "other tenant refresh token is unchanged");

  for (const email of [adminAEmail, staffAEmail]) {
    const response = await loginResponse(email, password);
    assert.equal(response.status, 403, "suspended tenant users cannot log in");
    const payload = await response.json();
    assert.equal(payload.code, "RESTAURANT_ACCOUNT_SUSPENDED");
    assert.equal(payload.message, "Restaurant account is suspended. Please contact support.");
  }

  const suspendedRefresh = await request("/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: adminASession.refreshToken }),
  });
  assert.equal(suspendedRefresh.status, 403, "pre-suspension refresh token receives account-state denial");
  assert.equal((await suspendedRefresh.json()).code, "RESTAURANT_ACCOUNT_SUSPENDED");

  const suspendedAccess = await request("/outlets/me", { headers: authHeaders(adminASession.accessToken) });
  assert.equal(suspendedAccess.status, 403, "pre-suspension access JWT cannot use protected APIs");
  assert.equal((await suspendedAccess.json()).code, "RESTAURANT_ACCOUNT_SUSPENDED");
  assert.equal((await request("/outlets/me", { headers: authHeaders(adminBSession.accessToken) })).status, 200, "different tenant remains active");
  assert.equal((await request("/super-admin/restaurants", { headers: authHeaders(superSession.accessToken) })).status, 200, "super admin remains unaffected");

  const activate = await request(`/super-admin/restaurants/${restaurantA._id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(superSession.accessToken) },
    body: JSON.stringify({ status: "active" }),
  });
  assert.equal(activate.status, 200);
  const reactivatedAdminSession = await login(adminAEmail, password);

  const orderId = new mongoose.Types.ObjectId();
  const order = await Order.create({
    _id: orderId,
    orderNumber: `ACCOUNT-ORDER-${suffix}`,
    restaurant: restaurantA._id,
    outlet: outletA._id,
    orderType: "TAKEAWAY",
    items: [{ menuItem: new mongoose.Types.ObjectId(), name: "Archive proof item", price: 100, quantity: 1, subtotal: 100 }],
    subtotal: 100,
    total: 100,
    paymentMethod: "UPI",
    paymentStatus: "AWAITING_VERIFICATION",
  });
  const bill = await Bill.create({
    billNumber: `ACCOUNT-BILL-${suffix}`,
    restaurant: restaurantA._id,
    outlet: outletA._id,
    allocations: [{ order: order._id, orderNumber: order.orderNumber, subtotal: 100, total: 100 }],
    subtotal: 100,
    total: 100,
    balanceDue: 100,
    createdBy: (await User.findOne({ email: adminAEmail }))._id,
  });
  const invoice = await Invoice.create({
    invoiceNumber: `ACCOUNT-INVOICE-${suffix}`,
    order: order._id,
    restaurant: restaurantA._id,
    items: [{ name: "Archive proof item", quantity: 1, price: 100, subtotal: 100 }],
    gstType: "CGST_SGST",
    subtotal: 100,
    cgst: 0,
    sgst: 0,
    igst: 0,
    totalTax: 0,
    total: 100,
    totalPaid: 0,
    netTotal: 100,
    netTax: 0,
  });
  const payment = await Payment.create({
    paymentId: `ACCOUNT-HOTEL-UPI-${suffix}`,
    orderId: order._id,
    restaurant: restaurantA._id,
    outlet: outletA._id,
    amount: 100,
    totalAmount: 100,
    paymentMethod: "UPI",
    provider: "HOTEL_UPI",
    paymentStatus: "AWAITING_VERIFICATION",
    transactionId: `account-tx-${suffix}`,
  });
  const hotelSettings = await HotelPaymentSettings.create({ restaurant: restaurantA._id, outlet: outletA._id, payeeName: "Archive Test", upiId: `archive-${suffix}@upi`, isEnabled: true, status: "ACTIVE" });

  const unauthorizedArchive = await request(`/super-admin/restaurants/${restaurantA._id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...authHeaders(reactivatedAdminSession.accessToken) },
    body: JSON.stringify({ confirm: true, confirmationName: restaurantA.name }),
  });
  assert.equal(unauthorizedArchive.status, 403, "only super_admin can archive");

  const missingConfirm = await request(`/super-admin/restaurants/${restaurantA._id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...authHeaders(superSession.accessToken) },
    body: JSON.stringify({ confirm: false, confirmationName: restaurantA.name }),
  });
  assert.equal(missingConfirm.status, 422, "archive requires confirm=true");

  const wrongName = await request(`/super-admin/restaurants/${restaurantA._id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...authHeaders(superSession.accessToken) },
    body: JSON.stringify({ confirm: true, confirmationName: "wrong tenant" }),
  });
  assert.equal(wrongName.status, 409, "archive rejects an incorrect confirmation name");

  const archive = await request(`/super-admin/restaurants/${restaurantA._id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...authHeaders(superSession.accessToken) },
    body: JSON.stringify({ confirm: true, confirmationName: `  ${restaurantA.name}  ` }),
  });
  assert.equal(archive.status, 200);
  const archivedRestaurant = await Restaurant.findById(restaurantA._id).lean();
  assert.equal(archivedRestaurant.isActive, false);
  assert.ok(archivedRestaurant.archivedAt);
  assert.equal(String(archivedRestaurant.archivedBy), String((await User.findOne({ email: superEmail }))._id));
  assert.equal((await User.findOne({ email: adminAEmail }).lean()).refreshToken, "", "archive clears tenant-only refresh tokens");

  assert.equal(await Order.countDocuments({ _id: order._id }), 1, "order history is preserved");
  assert.equal(await Bill.countDocuments({ _id: bill._id }), 1, "bill history is preserved");
  assert.equal(await Invoice.countDocuments({ _id: invoice._id }), 1, "invoice history is preserved");
  assert.equal(await Payment.countDocuments({ _id: payment._id, provider: "HOTEL_UPI" }), 1, "Hotel UPI payment history is preserved");
  assert.equal(await HotelPaymentSettings.countDocuments({ _id: hotelSettings._id }), 1, "Hotel UPI settings are preserved");

  const archivedLogin = await loginResponse(adminAEmail, password);
  assert.equal(archivedLogin.status, 403);
  assert.equal((await archivedLogin.json()).code, "RESTAURANT_ACCOUNT_ARCHIVED");
  const archivedRefresh = await request("/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: reactivatedAdminSession.refreshToken }),
  });
  assert.equal(archivedRefresh.status, 403);
  assert.equal((await archivedRefresh.json()).code, "RESTAURANT_ACCOUNT_ARCHIVED");
  const archivedAccess = await request("/outlets/me", { headers: authHeaders(reactivatedAdminSession.accessToken) });
  assert.equal(archivedAccess.status, 403, "pre-archive access JWT cannot use protected APIs");
  assert.equal((await archivedAccess.json()).code, "RESTAURANT_ACCOUNT_ARCHIVED");

  const repeatedArchive = await request(`/super-admin/restaurants/${restaurantA._id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...authHeaders(superSession.accessToken) },
    body: JSON.stringify({ confirm: true, confirmationName: restaurantA.name }),
  });
  assert.equal(repeatedArchive.status, 200, "repeated archive is idempotent");
  assert.equal((await repeatedArchive.json()).data.alreadyArchived, true);

  const crossTenantOutlet = await request("/outlets/active", {
    headers: authHeaders(adminBSession.accessToken, { "X-Outlet-Id": String(outletA._id) }),
  });
  assert.equal(crossTenantOutlet.status, 403, "outlet tenant isolation remains unchanged");
  assert.equal((await request("/outlets/me", { headers: authHeaders(adminBSession.accessToken) })).status, 200, "other tenant remains usable after archive");

  console.log("Restaurant account lifecycle integration checks passed.");
} finally {
  if (createdRestaurantIds.length) {
    const restaurantFilter = { $in: createdRestaurantIds };
    await Promise.all([
      HotelPaymentSettings.deleteMany({ restaurant: restaurantFilter }),
      Payment.deleteMany({ restaurant: restaurantFilter }),
      Invoice.deleteMany({ restaurant: restaurantFilter }),
      Bill.deleteMany({ restaurant: restaurantFilter }),
      Order.deleteMany({ restaurant: restaurantFilter }),
      Outlet.deleteMany({ restaurant: restaurantFilter }),
      User.deleteMany({ restaurant: restaurantFilter }),
      Log.deleteMany({ "context.restaurantId": restaurantFilter }),
      Restaurant.deleteMany({ _id: restaurantFilter }),
    ]);
  }
  if (createdEmails.length) await User.deleteMany({ email: { $in: createdEmails } });
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
}