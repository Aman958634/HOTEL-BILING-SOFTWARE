import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();
process.env.NODE_ENV = "test";

const testUri = String(process.env.TEST_MONGO_URI || "").trim();
const databaseName = (() => {
  try {
    return new URL(testUri.replace(/^mongodb(\+srv)?:\/\//, "http://")).pathname.replace(/^\//, "").split("/")[0];
  } catch {
    return "";
  }
})();
if (databaseName !== "restosphere_cashfree_test") {
  throw new Error("Refusing partial-payment fixture write: TEST_MONGO_URI must target restosphere_cashfree_test");
}

const [{ default: Restaurant }, { default: Outlet }, { default: User }, { default: Food }, { default: Table }, { default: Order }, { default: Payment }, { recordVerifiedPayment }] = await Promise.all([
  import("../models/Restaurant.js"),
  import("../models/Outlet.js"),
  import("../models/User.js"),
  import("../models/Food.js"),
  import("../models/Table.js"),
  import("../models/Order.js"),
  import("../models/Payment.js"),
  import("../services/paymentService.js"),
]);

await mongoose.connect(testUri, { serverSelectionTimeoutMS: 10000 });
try {
  const restaurant = await Restaurant.findOne({ slug: "cashfree-sandbox-test" });
  const outlet = await Outlet.findOne({ restaurant: restaurant?._id, code: "CFTEST" });
  const manager = await User.findOne({ email: "cashfree.manager@test.invalid" });
  const food = await Food.findOne({ restaurant: restaurant?._id, name: "Cashfree Test Item" });
  const table = await Table.findOne({ restaurant: restaurant?._id, outlet: outlet?._id, tableNumber: "CF-1" });
  if (!restaurant || !outlet || !manager || !food || !table) throw new Error("Seed the Cashfree test fixture first");

  const order = await Order.findOneAndUpdate(
    { restaurant: restaurant._id, outlet: outlet._id, orderNumber: "CF-SANDBOX-PARTIAL-1000" },
    {
      $set: {
        customer: manager._id,
        table: table._id,
        orderType: "DINE_IN",
        items: [{ menuItem: food._id, name: food.name, price: 1000, quantity: 1, subtotal: 1000 }],
        subtotal: 1000,
        tax: 0,
        discount: 0,
        serviceCharge: 0,
        total: 1000,
        paymentMethod: "CASHFREE",
        paymentStatus: "PENDING",
        status: "PENDING",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const cashKey = "cashfree-test-partial-cash-400";
  if (!(await Payment.exists({ orderId: order._id, idempotencyKey: cashKey }))) {
    await recordVerifiedPayment(order, {
      amount: 400,
      paymentMethod: "CASH",
      gateway: "Cash",
      transactionId: "CFTEST-PARTIAL-CASH-400",
      idempotencyKey: cashKey,
      receivedBy: manager._id,
      note: "Isolated Cashfree partial-payment fixture",
    });
  }

  const paid = await Payment.aggregate([
    { $match: { orderId: order._id, paymentStatus: "PAID" } },
    { $group: { _id: null, amount: { $sum: "$amount" } } },
  ]);
  const paidAmount = Number(paid[0]?.amount || 0);
  if (paidAmount !== 400) throw new Error(`Expected isolated partial payment of 400; found ${paidAmount}`);
  console.log(JSON.stringify({ database: databaseName, orderId: String(order._id), orderAmount: order.total, alreadyPaid: paidAmount, expectedCashfreeAmount: 600 }));
} finally {
  await mongoose.disconnect();
}
