import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Restaurant from "../models/Restaurant.js";
import Outlet from "../models/Outlet.js";
import Table from "../models/Table.js";
import Order from "../models/Order.js";
import { assignTableForDineInOrder } from "../services/tableOrderService.js";
import { updateTableStatus } from "../services/tableStateService.js";
import { requireSafeTestDatabase } from "./testDatabase.js";

const { uri } = requireSafeTestDatabase();
const suffix = crypto.randomBytes(6).toString("hex");
await mongoose.connect(uri, { autoIndex: false, autoCreate: false });

const restaurant = await Restaurant.create({ name: `Table Lifecycle ${suffix}`, slug: `table-lifecycle-${suffix}`, branchCode: `TL-${suffix.slice(0, 8)}`, address: "Test" });
const [outletA, outletB] = await Outlet.create([
  { restaurant: restaurant._id, name: "A", code: `A-${suffix}`, isDefault: true },
  { restaurant: restaurant._id, name: "B", code: `B-${suffix}` },
]);
const table = await Table.create({ restaurant: restaurant._id, outlet: outletA._id, tableNumber: `T-${suffix}`, capacity: 4, floor: "1", section: "Main" });
const makeOrder = (number, status = "PENDING", billingState = "") => Order.create({
  orderNumber: number,
  restaurant: restaurant._id,
  outlet: outletA._id,
  table: table._id,
  orderType: "DINE_IN",
  orderSource: "DINE_IN",
  items: [{ menuItem: new mongoose.Types.ObjectId(), name: "Test", price: 100, quantity: 1, subtotal: 100 }],
  subtotal: 100,
  total: 100,
  status,
  billingState,
  paymentStatus: "PENDING",
});

try {
  const first = await makeOrder(`TL-${suffix}-1`);
  await updateTableStatus(table._id);
  assert.equal((await Table.findById(table._id)).status, "OCCUPIED");

  const second = await makeOrder(`TL-${suffix}-2`);
  await Promise.all([updateTableStatus(table._id), updateTableStatus(table._id)]);
  assert.equal((await Table.findById(table._id)).status, "OCCUPIED");

  await Order.updateOne({ _id: first._id }, { $set: { status: "SERVED", billingState: "SETTLED" } });
  await updateTableStatus(table._id);
  assert.equal((await Table.findById(table._id)).status, "OCCUPIED");

  await Order.updateOne({ _id: second._id }, { $set: { status: "CANCELLED" } });
  await updateTableStatus(table._id);
  await updateTableStatus(table._id);
  assert.equal((await Table.findById(table._id)).status, "AVAILABLE");

  await assert.rejects(() => assignTableForDineInOrder(table._id, null, { restaurantId: new mongoose.Types.ObjectId(), alreadyValidated: false }), /Table does not belong|Table not found/);
  console.log("Table lifecycle tests passed.");
} finally {
  await Order.deleteMany({ restaurant: restaurant._id });
  await Table.deleteMany({ restaurant: restaurant._id });
  await Outlet.deleteMany({ restaurant: restaurant._id });
  await Restaurant.deleteOne({ _id: restaurant._id });
  await mongoose.disconnect();
}
