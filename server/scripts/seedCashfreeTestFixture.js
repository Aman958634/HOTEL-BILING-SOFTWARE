import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();
process.env.NODE_ENV = "test";

const TEST_URI = String(process.env.TEST_MONGO_URI || "").trim();
const databaseName = (() => {
  try { return new URL(TEST_URI.replace(/^mongodb(\+srv)?:\/\//, "http://")).pathname.replace(/^\//, "").split("/")[0]; } catch { return ""; }
})();
if (databaseName !== "restosphere_cashfree_test") throw new Error("Refusing fixture write: TEST_MONGO_URI must target restosphere_cashfree_test");

const [{ default: Restaurant }, { default: Outlet }, { default: User }, { default: Category }, { default: Food }, { default: Table }, { default: Order }, { default: Subscription }] = await Promise.all([
  import("../models/Restaurant.js"), import("../models/Outlet.js"), import("../models/User.js"), import("../models/Category.js"), import("../models/Food.js"), import("../models/Table.js"), import("../models/Order.js"), import("../models/Subscription.js"),
]);

await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 10000 });
try {
  const restaurant = await Restaurant.findOneAndUpdate({ slug: "cashfree-sandbox-test" }, { $set: { name: "Cashfree Sandbox Test Restaurant", slug: "cashfree-sandbox-test", branchCode: "CFTEST", address: "Isolated local fixture", city: "Test City", isActive: true } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  await Subscription.findOneAndUpdate(
    { restaurant: restaurant._id },
    { $set: { planName: "cashfree-sandbox-test", price: 0, status: "active", startDate: new Date(), renewalDate: null, metadata: { isolatedTestFixture: true } } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const outlet = await Outlet.findOneAndUpdate({ restaurant: restaurant._id, code: "CFTEST" }, { $set: { name: "Cashfree Test Outlet", address: "Isolated local fixture", isActive: true, isDefault: true } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  const manager = await User.findOneAndUpdate({ email: "cashfree.manager@test.invalid" }, { $set: { fullName: "Cashfree Test Manager", phone: "9999999999", role: "manager", restaurant: restaurant._id, defaultOutlet: outlet._id, outletAccess: [{ outlet: outlet._id, role: "manager", isActive: true }], allOutletsAccess: false, isActive: true } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  const managerWithPassword = await User.findById(manager._id).select("+password");
  managerWithPassword.password = "CashfreeSandboxTestOnly!1";
  managerWithPassword.markModified("password");
  await managerWithPassword.save();
  const category = await Category.findOneAndUpdate({ restaurant: restaurant._id, slug: "cashfree-test" }, { $set: { name: "Cashfree Test", slug: "cashfree-test", active: true } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  const food = await Food.findOneAndUpdate({ restaurant: restaurant._id, name: "Cashfree Test Item" }, { $set: { category: category._id, name: "Cashfree Test Item", price: 100, isAvailable: true, available: true } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  const table = await Table.findOneAndUpdate({ restaurant: restaurant._id, outlet: outlet._id, tableNumber: "CF-1" }, { $set: { capacity: 2, floor: "Test", section: "Sandbox", status: "AVAILABLE" } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  const order = await Order.findOneAndUpdate({ restaurant: restaurant._id, outlet: outlet._id, orderNumber: "CF-SANDBOX-100" }, { $set: { customer: manager._id, table: table._id, orderType: "DINE_IN", items: [{ menuItem: food._id, name: food.name, price: 100, quantity: 1, subtotal: 100 }], subtotal: 100, tax: 0, discount: 0, serviceCharge: 0, total: 100, paymentMethod: "CASHFREE", paymentStatus: "PENDING", status: "PENDING" } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  const counts = await Promise.all([Restaurant.countDocuments({ _id: restaurant._id }), Outlet.countDocuments({ _id: outlet._id }), User.countDocuments({ _id: manager._id }), Food.countDocuments({ _id: food._id }), Table.countDocuments({ _id: table._id }), Order.countDocuments({ _id: order._id, paymentStatus: "PENDING", total: 100 })]);
  if (counts.some((count) => count !== 1)) throw new Error("Fixture verification failed");
  console.log(JSON.stringify({ database: databaseName, restaurantId: String(restaurant._id), outletId: String(outlet._id), managerEmail: manager.email, orderId: String(order._id), orderAmount: order.total }));
} finally {
  await mongoose.disconnect();
}
