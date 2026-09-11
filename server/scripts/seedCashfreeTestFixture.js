import dotenv from "dotenv";
import mongoose from "mongoose";
import { requireCashfreeFixtureEnvironment } from "../utils/cashfreeFixtureGuard.js";

dotenv.config();
requireCashfreeFixtureEnvironment();

const TEST_URI = String(process.env.TEST_MONGO_URI || "").trim();
const databaseName = (() => {
  try { return new URL(TEST_URI.replace(/^mongodb(\+srv)?:\/\//, "http://")).pathname.replace(/^\//, "").split("/")[0]; } catch { return ""; }
})();
if (databaseName !== "restosphere_cashfree_test") throw new Error("Refusing fixture write: TEST_MONGO_URI must target restosphere_cashfree_test");

const [{ default: Restaurant }, { default: Outlet }, { default: User }, { default: Category }, { default: Food }, { default: Table }, { default: Order }, { default: Subscription }, { default: RestaurantSettlementProfile }, { default: RestaurantCommissionConfig }] = await Promise.all([
  import("../models/Restaurant.js"), import("../models/Outlet.js"), import("../models/User.js"), import("../models/Category.js"), import("../models/Food.js"), import("../models/Table.js"), import("../models/Order.js"), import("../models/Subscription.js"), import("../models/RestaurantSettlementProfile.js"), import("../models/RestaurantCommissionConfig.js"),
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
  const restaurantAdmin = await User.findOneAndUpdate(
    { email: "cashfree.admin@test.invalid" },
    { $set: { fullName: "Cashfree Test Restaurant Admin", phone: "9999999998", role: "restaurant_admin", restaurant: restaurant._id, defaultOutlet: outlet._id, outletAccess: [{ outlet: outlet._id, role: "restaurant_admin", isActive: true }], allOutletsAccess: false, isActive: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const restaurantAdminWithPassword = await User.findById(restaurantAdmin._id).select("+password");
  restaurantAdminWithPassword.password = "CashfreeSandboxTestOnly!1";
  restaurantAdminWithPassword.markModified("password");
  await restaurantAdminWithPassword.save();
  const superAdmin = await User.findOneAndUpdate(
    { email: "cashfree.superadmin@test.invalid" },
    { $set: { fullName: "Cashfree Test Super Admin", phone: "9999999997", role: "super_admin", restaurant: null, defaultOutlet: null, outletAccess: [], allOutletsAccess: true, isActive: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const superAdminWithPassword = await User.findById(superAdmin._id).select("+password");
  superAdminWithPassword.password = "CashfreeSandboxTestOnly!1";
  superAdminWithPassword.markModified("password");
  await superAdminWithPassword.save();
  const settlementProfile = await RestaurantSettlementProfile.findOneAndUpdate(
    { restaurant: restaurant._id, provider: "CASHFREE" },
    { $set: { providerVendorId: "LOCAL_CASHFREE_SANDBOX_VENDOR", vendorStatus: "ACTIVE", payoutMethod: "BANK", providerStatus: "ACTIVE", bankVerificationStatus: "VERIFIED", settlementStatus: "ACTIVE", settlementCycle: "T+1", accountHolderName: "Cashfree Sandbox Test", bankName: "Local Sandbox Bank", maskedAccountNumber: "••••1191", ifscSafeValue: "YESB0000262", verificationReference: "LOCAL_FIXTURE", verificationMessageSafe: "Isolated local fixture", verifiedAt: new Date(), activatedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const commissionConfig = await RestaurantCommissionConfig.findOneAndUpdate(
    { restaurant: restaurant._id },
    { $set: { commissionType: "PERCENTAGE", commissionBps: 200, fixedAmountPaise: 0, effectiveFrom: new Date(), updatedBy: restaurantAdmin._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const category = await Category.findOneAndUpdate({ restaurant: restaurant._id, slug: "cashfree-test" }, { $set: { name: "Cashfree Test", slug: "cashfree-test", active: true } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  const food = await Food.findOneAndUpdate({ restaurant: restaurant._id, name: "Cashfree Test Item" }, { $set: { category: category._id, name: "Cashfree Test Item", price: 100, isAvailable: true, available: true } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  const table = await Table.findOneAndUpdate({ restaurant: restaurant._id, outlet: outlet._id, tableNumber: "CF-1" }, { $set: { capacity: 2, floor: "Test", section: "Sandbox", status: "AVAILABLE" } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  // Never reuse a completed checkout fixture. The historic ₹100 payment is
  // retained for audit, while this seed order remains safe to recreate.
  const order = await Order.findOneAndUpdate({ restaurant: restaurant._id, outlet: outlet._id, orderNumber: "CF-SANDBOX-SEED-100" }, { $set: { customer: manager._id, table: table._id, orderType: "DINE_IN", items: [{ menuItem: food._id, name: food.name, price: 100, quantity: 1, subtotal: 100 }], subtotal: 100, tax: 0, discount: 0, serviceCharge: 0, total: 100, paymentMethod: "CASHFREE", paymentStatus: "PENDING", status: "PENDING" } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  const counts = await Promise.all([Restaurant.countDocuments({ _id: restaurant._id }), Outlet.countDocuments({ _id: outlet._id }), User.countDocuments({ _id: manager._id }), User.countDocuments({ _id: restaurantAdmin._id, role: "restaurant_admin" }), User.countDocuments({ _id: superAdmin._id, role: "super_admin" }), Food.countDocuments({ _id: food._id }), Table.countDocuments({ _id: table._id }), Order.countDocuments({ _id: order._id, paymentStatus: "PENDING", total: 100 }), RestaurantSettlementProfile.countDocuments({ _id: settlementProfile._id, vendorStatus: "ACTIVE", bankVerificationStatus: "VERIFIED", settlementStatus: "ACTIVE" }), RestaurantCommissionConfig.countDocuments({ _id: commissionConfig._id, commissionType: "PERCENTAGE", commissionBps: 200 })]);
  if (counts.some((count) => count !== 1)) throw new Error("Fixture verification failed");
  console.log(JSON.stringify({ database: databaseName, restaurantId: String(restaurant._id), outletId: String(outlet._id), managerEmail: manager.email, restaurantAdminEmail: restaurantAdmin.email, superAdminEmail: superAdmin.email, orderId: String(order._id), orderAmount: order.total, vendorStatus: settlementProfile.vendorStatus, bankVerificationStatus: settlementProfile.bankVerificationStatus, settlementStatus: settlementProfile.settlementStatus, commissionType: commissionConfig.commissionType, commissionBps: commissionConfig.commissionBps }));
} finally {
  await mongoose.disconnect();
}
