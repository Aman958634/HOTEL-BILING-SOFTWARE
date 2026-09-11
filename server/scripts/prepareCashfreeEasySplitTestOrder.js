import crypto from "crypto";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { requireCashfreeFixtureEnvironment } from "../utils/cashfreeFixtureGuard.js";

dotenv.config();
requireCashfreeFixtureEnvironment();

const testUri = String(process.env.TEST_MONGO_URI || "").trim();
const databaseName = (() => {
  try { return new URL(testUri.replace(/^mongodb(\+srv)?:\/\//, "http://")).pathname.replace(/^\//, "").split("/")[0]; } catch { return ""; }
})();
if (databaseName !== "restosphere_cashfree_test") throw new Error("Refusing order preparation: TEST_MONGO_URI must target restosphere_cashfree_test");

const [{ default: Restaurant }, { default: Outlet }, { default: User }, { default: Food }, { default: Table }, { default: Order }, { default: RestaurantSettlementProfile }, { default: RestaurantCommissionConfig }] = await Promise.all([
  import("../models/Restaurant.js"), import("../models/Outlet.js"), import("../models/User.js"), import("../models/Food.js"), import("../models/Table.js"), import("../models/Order.js"), import("../models/RestaurantSettlementProfile.js"), import("../models/RestaurantCommissionConfig.js"),
]);

await mongoose.connect(testUri, { serverSelectionTimeoutMS: 10000 });
try {
  const restaurant = await Restaurant.findOne({ slug: "cashfree-sandbox-test", isActive: true });
  const outlet = await Outlet.findOne({ restaurant: restaurant?._id, code: "CFTEST", isActive: true });
  const admin = await User.findOne({ email: "cashfree.admin@test.invalid", role: "restaurant_admin", restaurant: restaurant?._id, isActive: true });
  const food = await Food.findOne({ restaurant: restaurant?._id, name: "Cashfree Test Item", isAvailable: true });
  const table = await Table.findOne({ restaurant: restaurant?._id, outlet: outlet?._id, tableNumber: "CF-1" });
  const profile = await RestaurantSettlementProfile.findOne({ restaurant: restaurant?._id, provider: "CASHFREE", vendorStatus: "ACTIVE", bankVerificationStatus: "VERIFIED", settlementStatus: "ACTIVE" });
  const commission = await RestaurantCommissionConfig.findOne({ restaurant: restaurant?._id, commissionType: "PERCENTAGE", commissionBps: 200 });
  if (!restaurant || !outlet || !admin || !food || !table || !profile || !commission) throw new Error("Seed the isolated Cashfree fixture with active Phase 1 vendor, verified bank, and 2% commission first");

  const orderNumber = `CF-PHASE2-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
  const order = await Order.create({
    orderNumber,
    customer: admin._id,
    table: table._id,
    restaurant: restaurant._id,
    outlet: outlet._id,
    orderType: "DINE_IN",
    items: [{ menuItem: food._id, name: food.name, price: 100, quantity: 1, subtotal: 100 }],
    subtotal: 100,
    tax: 0,
    discount: 0,
    serviceCharge: 0,
    total: 100,
    paymentMethod: "CASHFREE",
    paymentStatus: "PENDING",
    status: "PENDING",
  });
  console.log(JSON.stringify({ database: databaseName, orderId: String(order._id), orderNumber: order.orderNumber, grossAmount: order.total, paymentStatus: order.paymentStatus, vendorStatus: profile.vendorStatus, bankVerificationStatus: profile.bankVerificationStatus, commissionType: commission.commissionType, commissionBps: commission.commissionBps }));
} finally {
  await mongoose.disconnect();
}
