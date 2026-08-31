import assert from "node:assert/strict";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Category from "../models/Category.js";
import Food from "../models/Food.js";
import Invoice from "../models/Invoice.js";
import Notification from "../models/Notification.js";
import Order from "../models/Order.js";
import Outlet from "../models/Outlet.js";
import Payment from "../models/Payment.js";
import Restaurant from "../models/Restaurant.js";
import User from "../models/User.js";
import { dashboardStats as analyticsDashboardStats } from "../controllers/analyticsController.js";
import { dashboardStats as adminDashboardStats } from "../controllers/adminController.js";
import { getBusinessIntelligence } from "../controllers/businessIntelligenceController.js";
import { deleteNotification, getNotificationSummary, getNotifications, markAllNotificationsRead } from "../controllers/notificationController.js";
import { getPaymentById, refundPayment, verifyPayment } from "../controllers/paymentController.js";
import { getRevenueReport, getTopItemsReport } from "../controllers/reportController.js";
import { protect } from "../middleware/auth.js";
import { getAuthorizedSocketRooms, resolveSocketContext } from "../config/socket.js";
import { requireSafeTestDatabase } from "./testDatabase.js";

const { uri, databaseName, hostClass } = requireSafeTestDatabase();
process.env.JWT_ACCESS_SECRET ||= crypto.randomBytes(32).toString("hex");

const suffix = crypto.randomBytes(6).toString("hex");
const created = {
  restaurants: [], outlets: [], categories: [], foods: [], orders: [], invoices: [], payments: [], users: [], notifications: [],
};

const invoke = (handler, req) => new Promise((resolve) => {
  let finished = false;
  const finish = (result) => {
    if (!finished) {
      finished = true;
      resolve(result);
    }
  };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { finish({ statusCode: this.statusCode, body }); },
    send(body) { finish({ statusCode: this.statusCode, body }); },
    setHeader() {},
  };
  try {
    handler(req, res, (error) => finish({ statusCode: error?.statusCode || 500, error }));
  } catch (error) {
    finish({ statusCode: error?.statusCode || 500, error });
  }
});

const request = (user, { params = {}, query = {}, body = {} } = {}) => ({
  user,
  params,
  query,
  body,
  get: () => "",
});

const protectRequest = (token, headers = {}) => new Promise((resolve) => {
  const normalizedHeaders = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  const req = {
    headers: { authorization: `Bearer ${token}`, ...normalizedHeaders },
    get: (name) => normalizedHeaders[String(name).toLowerCase()] || undefined,
  };
  protect(req, {}, (error) => resolve({ req, error }));
});

const userContext = (user, activeOutlet, allOutletsScope = false) => ({
  _id: user._id,
  role: user.role,
  restaurant: user.restaurant,
  defaultOutlet: user.defaultOutlet,
  activeOutlet,
  outletAccess: user.outletAccess,
  allOutletsAccess: user.allOutletsAccess === true,
  allOutletsScope,
});

const addOrder = async ({ restaurant, outlet, food, amount, label }) => {
  const order = await Order.create({
    orderNumber: `RV-${label}-${suffix}`,
    restaurant: restaurant._id,
    outlet: outlet._id,
    orderType: "TAKEAWAY",
    orderSource: "TAKEAWAY",
    items: [{ menuItem: food._id, name: food.name, price: amount, quantity: 1, subtotal: amount }],
    subtotal: amount,
    total: amount,
    paymentStatus: "PAID",
    paymentMethod: "CASH",
    paidAt: new Date(),
    status: "COMPLETED",
  });
  created.orders.push(order._id);

  const invoice = await Invoice.create({
    invoiceNumber: `RV-INV-${label}-${suffix}`,
    order: order._id,
    restaurant: restaurant._id,
    issuedAt: new Date(),
    items: [{ name: food.name, quantity: 1, price: amount, subtotal: amount }],
    gstType: "CGST_SGST",
    subtotal: amount,
    totalTax: 0,
    total: amount,
    totalPaid: amount,
    netTotal: amount,
    netTax: 0,
  });
  created.invoices.push(invoice._id);

  const payment = await Payment.create({
    paymentId: `RV-PAY-${label}-${suffix}`,
    orderId: order._id,
    restaurant: restaurant._id,
    outlet: outlet._id,
    amount,
    totalAmount: amount,
    paymentMethod: "CASH",
    paymentStatus: "PAID",
    transactionId: `rv-txn-${label}-${suffix}`,
    paidAt: new Date(),
  });
  created.payments.push(payment._id);
  return { order, payment };
};

const addNotification = async ({ user, restaurant, outlet = null, title }) => {
  const notification = await Notification.create({
    user: user._id,
    restaurantId: restaurant._id,
    outlet: outlet?._id || null,
    eventType: "ORDER_CREATED",
    type: "ORDER_CREATED",
    category: "ORDER",
    title,
    message: title,
  });
  created.notifications.push(notification._id);
  return notification;
};

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  console.log("Release verification: connected to isolated database.");

  const [restaurantA, restaurantB] = await Promise.all([
    Restaurant.create({ name: `Release A ${suffix}`, slug: `release-a-${suffix}`, branchCode: `RA${suffix}`, address: "Test" }),
    Restaurant.create({ name: `Release B ${suffix}`, slug: `release-b-${suffix}`, branchCode: `RB${suffix}`, address: "Test" }),
  ]);
  created.restaurants.push(restaurantA._id, restaurantB._id);

  const [outletA1, outletA2, outletB1] = await Promise.all([
    Outlet.create({ restaurant: restaurantA._id, name: "A1", code: "A1", isDefault: true }),
    Outlet.create({ restaurant: restaurantA._id, name: "A2", code: "A2" }),
    Outlet.create({ restaurant: restaurantB._id, name: "B1", code: "B1", isDefault: true }),
  ]);
  created.outlets.push(outletA1._id, outletA2._id, outletB1._id);

  const [categoryA, categoryB] = await Promise.all([
    Category.create({ restaurant: restaurantA._id, name: "Release", slug: `release-a-${suffix}` }),
    Category.create({ restaurant: restaurantB._id, name: "Release", slug: `release-b-${suffix}` }),
  ]);
  created.categories.push(categoryA._id, categoryB._id);
  const [foodA, foodB] = await Promise.all([
    Food.create({ restaurant: restaurantA._id, category: categoryA._id, name: `A item ${suffix}`, price: 100 }),
    Food.create({ restaurant: restaurantB._id, category: categoryB._id, name: `B item ${suffix}`, price: 900 }),
  ]);
  created.foods.push(foodA._id, foodB._id);

  const [userA, managerA, userB] = await Promise.all([
    User.create({ fullName: "Outlet A user", email: `outlet-a-${suffix}@test.invalid`, password: "release-test-password", role: "staff", restaurant: restaurantA._id, defaultOutlet: outletA1._id, outletAccess: [{ outlet: outletA1._id }] }),
    User.create({ fullName: "Outlet A manager", email: `manager-a-${suffix}@test.invalid`, password: "release-test-password", role: "manager", restaurant: restaurantA._id, defaultOutlet: outletA1._id, outletAccess: [{ outlet: outletA1._id }, { outlet: outletA2._id }], allOutletsAccess: true }),
    User.create({ fullName: "Outlet B user", email: `outlet-b-${suffix}@test.invalid`, password: "release-test-password", role: "staff", restaurant: restaurantB._id, defaultOutlet: outletB1._id, outletAccess: [{ outlet: outletB1._id }] }),
  ]);
  created.users.push(userA._id, managerA._id, userB._id);
  console.log("Release verification: tenant and outlet fixtures created.");

  const [{ order: orderA1, payment: paymentA1 }] = await Promise.all([
    addOrder({ restaurant: restaurantA, outlet: outletA1, food: foodA, amount: 100, label: "A1" }),
    addOrder({ restaurant: restaurantA, outlet: outletA2, food: foodA, amount: 300, label: "A2" }),
    addOrder({ restaurant: restaurantB, outlet: outletB1, food: foodB, amount: 900, label: "B1" }),
  ]);
  console.log("Release verification: order, invoice, and payment fixtures created.");

  // Middleware verifies that supplied outlet headers/scopes are authorization
  // context only; the request cannot move a staff member across outlets.
  const tokenA = jwt.sign({ id: String(userA._id) }, process.env.JWT_ACCESS_SECRET);
  const tokenManager = jwt.sign({ id: String(managerA._id) }, process.env.JWT_ACCESS_SECRET);
  assert.equal((await protectRequest(tokenA, { "X-Outlet-Id": String(outletA1._id) })).error, undefined);
  assert.equal((await protectRequest(tokenA, { "X-Outlet-Id": String(outletA2._id) })).error?.statusCode, 403);
  assert.equal((await protectRequest(tokenA, { "X-Outlet-Id": String(outletB1._id) })).error?.statusCode, 403);
  assert.equal((await protectRequest(tokenA, { "X-Outlet-Scope": "all" })).error?.statusCode, 403);
  const allOutletAuth = await protectRequest(tokenManager, { "X-Outlet-Scope": "all" });
  assert.equal(allOutletAuth.error, undefined);
  assert.equal(allOutletAuth.req.user.allOutletsScope, true);
  console.log("Release verification: HTTP outlet authorization checked.");

  const currentA1 = userContext(managerA, outletA1._id);
  const currentA2 = userContext(managerA, outletA2._id);
  const allA = userContext(managerA, outletA1._id, true);
  const currentB1 = userContext(userB, outletB1._id);

  const analyticsA1 = await invoke(analyticsDashboardStats, request(currentA1));
  const analyticsA2 = await invoke(analyticsDashboardStats, request(currentA2));
  assert.equal(analyticsA1.statusCode, 200);
  assert.equal(analyticsA1.body.data.cards.revenue, 100);
  assert.equal(analyticsA2.body.data.cards.revenue, 300);
  console.log("Release verification: active-outlet dashboard checked.");

  const biA1 = await invoke(getBusinessIntelligence, request(currentA1, { query: { range: "this_month" } }));
  const biAll = await invoke(getBusinessIntelligence, request(allA, { query: { range: "this_month" } }));
  assert.equal(biA1.statusCode, 200);
  assert.equal(biA1.body.data.overview.netSales.current, 100);
  assert.equal(biAll.statusCode, 200);
  assert.equal(biAll.body.data.overview.netSales.current, 400);
  assert.notEqual(biAll.body.data.overview.netSales.current, 1300);
  console.log("Release verification: BI outlet scopes checked.");

  const adminA1 = await invoke(adminDashboardStats, request(currentA1));
  const adminAll = await invoke(adminDashboardStats, request(allA));
  assert.equal(adminA1.statusCode, 200);
  assert.equal(adminA1.body.data.totalRevenue.value, 100);
  assert.equal(adminAll.statusCode, 200);
  assert.equal(adminAll.body.data.totalRevenue.value, 400);

  const reportA1 = await invoke(getRevenueReport, request(currentA1, { query: { range: "this_month" } }));
  const reportAll = await invoke(getRevenueReport, request(allA, { query: { range: "this_month" } }));
  const topItemsA1 = await invoke(getTopItemsReport, request(currentA1, { query: { range: "this_month" } }));
  assert.equal(reportA1.statusCode, 200);
  assert.equal(reportA1.body.data.totalRevenue, 100);
  assert.equal(reportAll.statusCode, 200);
  assert.equal(reportAll.body.data.totalRevenue, 400);
  assert.equal(topItemsA1.statusCode, 200);
  assert.equal(topItemsA1.body.data.length, 1);
  assert.equal(topItemsA1.body.data[0].revenue, 100);
  console.log("Release verification: report outlet scopes checked.");

  const [notificationA1, notificationA2, notificationNeutral, notificationB1, notificationManagerA1, notificationManagerA2, notificationManagerB1] = await Promise.all([
    addNotification({ user: userA, restaurant: restaurantA, outlet: outletA1, title: "A1" }),
    addNotification({ user: userA, restaurant: restaurantA, outlet: outletA2, title: "A2" }),
    addNotification({ user: userA, restaurant: restaurantA, title: "Neutral" }),
    addNotification({ user: userB, restaurant: restaurantB, outlet: outletB1, title: "B1" }),
    addNotification({ user: managerA, restaurant: restaurantA, outlet: outletA1, title: "Manager A1" }),
    addNotification({ user: managerA, restaurant: restaurantA, outlet: outletA2, title: "Manager A2" }),
    addNotification({ user: managerA, restaurant: restaurantB, outlet: outletB1, title: "Forged foreign" }),
  ]);

  const notificationsA1 = await invoke(getNotifications, request(userContext(userA, outletA1._id), { query: { page: 1, limit: 20 } }));
  const summaryA1 = await invoke(getNotificationSummary, request(userContext(userA, outletA1._id)));
  assert.equal(notificationsA1.statusCode, 200);
  assert.deepEqual(new Set(notificationsA1.body.data.map((row) => String(row._id))), new Set([String(notificationA1._id), String(notificationNeutral._id)]));
  assert.equal(summaryA1.statusCode, 200);
  assert.equal(summaryA1.body.data.unread, 2);
  const notificationsB1 = await invoke(getNotifications, request(currentB1, { query: { page: 1, limit: 20 } }));
  assert.equal(notificationsB1.statusCode, 200);
  assert.deepEqual(new Set(notificationsB1.body.data.map((row) => String(row._id))), new Set([String(notificationB1._id)]));

  const marked = await invoke(markAllNotificationsRead, request(userContext(userA, outletA1._id)));
  assert.equal(marked.statusCode, 200);
  assert.equal((await Notification.findById(notificationA1._id)).isRead, true);
  assert.equal((await Notification.findById(notificationNeutral._id)).isRead, true);
  assert.equal((await Notification.findById(notificationA2._id)).isRead, false);
  const forbiddenDelete = await invoke(deleteNotification, request(userContext(userA, outletA1._id), { params: { id: String(notificationA2._id) } }));
  assert.equal(forbiddenDelete.statusCode, 404);
  assert.ok(await Notification.exists({ _id: notificationA2._id }));

  const managerAllNotifications = await invoke(getNotifications, request(allA, { query: { page: 1, limit: 20 } }));
  assert.equal(managerAllNotifications.statusCode, 200);
  assert.deepEqual(new Set(managerAllNotifications.body.data.map((row) => String(row._id))), new Set([String(notificationManagerA1._id), String(notificationManagerA2._id)]));
  assert.ok(!(managerAllNotifications.body.data || []).some((row) => String(row._id) === String(notificationManagerB1._id)));
  assert.ok(await Notification.exists({ _id: notificationB1._id }));
  console.log("Release verification: notification outlet scopes checked.");

  const paymentA1Result = await invoke(getPaymentById, request(currentA1, { params: { id: String(paymentA1._id) } }));
  const paymentA2Result = await invoke(getPaymentById, request(currentA2, { params: { id: String(paymentA1._id) } }));
  const paymentBResult = await invoke(getPaymentById, request(currentB1, { params: { id: String(paymentA1._id) } }));
  assert.equal(paymentA1Result.statusCode, 200);
  assert.equal(paymentA2Result.statusCode, 404);
  assert.equal(paymentBResult.statusCode, 404);
  const untrustedDigitalSuccess = await invoke(verifyPayment, request(currentA1, {
    body: { orderId: String(orderA1._id), provider: "upi", paymentMethod: "UPI", status: "success" },
  }));
  const invalidRazorpayVerification = await invoke(verifyPayment, request(currentA1, {
    body: { orderId: String(orderA1._id), provider: "razorpay", status: "success", razorpay_order_id: "forged" },
  }));
  const foreignRefund = await invoke(refundPayment, request(currentB1, {
    params: { id: String(paymentA1._id) },
    body: { refundType: "full", refundReason: "forged cross-tenant refund" },
  }));
  assert.equal(untrustedDigitalSuccess.statusCode, 422);
  assert.equal(invalidRazorpayVerification.statusCode, 422);
  assert.equal(foreignRefund.statusCode, 404);
  console.log("Release verification: payment outlet ownership checked.");

  const socketA1 = await resolveSocketContext({ auth: { token: tokenA, outletId: String(outletA1._id) } });
  assert.ok(getAuthorizedSocketRooms(socketA1).includes(`outlet:${outletA1._id}`));
  assert.ok(!getAuthorizedSocketRooms(socketA1).includes(`outlet:${outletA2._id}`));
  await assert.rejects(() => resolveSocketContext({ auth: { token: tokenA, outletId: String(outletA2._id) } }), /Forbidden outlet/);
  await assert.rejects(() => resolveSocketContext({ auth: { token: tokenManager, outletId: String(outletB1._id) } }), /Forbidden outlet/);
  const socketAllA2 = await resolveSocketContext({ auth: { token: tokenManager, outletId: String(outletA2._id) } });
  assert.ok(getAuthorizedSocketRooms(socketAllA2).includes(`outlet:${outletA2._id}`));
  const staleDefault = await resolveSocketContext({ auth: { token: tokenA } });
  assert.ok(!getAuthorizedSocketRooms(staleDefault).some((room) => room.startsWith("outlet:")));

  console.log(`Release verification database tests passed (host class: ${hostClass}, database: ${databaseName}).`);
} finally {
  if (mongoose.connection.readyState === 1) {
    await Promise.all([
      Notification.deleteMany({ _id: { $in: created.notifications } }),
      Payment.deleteMany({ _id: { $in: created.payments } }),
      Invoice.deleteMany({ _id: { $in: created.invoices } }),
      Order.deleteMany({ _id: { $in: created.orders } }),
      Food.deleteMany({ _id: { $in: created.foods } }),
      Category.deleteMany({ _id: { $in: created.categories } }),
      User.deleteMany({ _id: { $in: created.users } }),
      Outlet.deleteMany({ _id: { $in: created.outlets } }),
      Restaurant.deleteMany({ _id: { $in: created.restaurants } }),
    ]);
    await mongoose.disconnect();
  }
}
