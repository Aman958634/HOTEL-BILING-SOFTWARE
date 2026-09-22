import mongoose from "mongoose";
import "dotenv/config";
import Category from "../models/Category.js";
import Food from "../models/Food.js";
import KotTicket from "../models/KotTicket.js";
import Order from "../models/Order.js";
import Outlet from "../models/Outlet.js";
import Restaurant from "../models/Restaurant.js";
import Subscription from "../models/Subscription.js";
import Table from "../models/Table.js";
import User from "../models/User.js";
import { requireSafeTestDatabase } from "../tests/testDatabase.js";

const { uri } = requireSafeTestDatabase();
const password = "RoleMatrix@123";
const slug = "browser-role-matrix-fixture";
const emails = [
  "browser-super-admin@test.invalid",
  "browser-kitchen-manager@test.invalid",
  "browser-cashier@test.invalid",
  "browser-manager@test.invalid",
  "browser-admin@test.invalid",
];

await mongoose.connect(uri);
await User.deleteMany({ $or: [{ email: { $in: emails } }, { email: /^browser-registration-e2e-/ }] });

const oldRestaurant = await Restaurant.findOne({ slug });
if (oldRestaurant) {
  await Promise.all([
    User.deleteMany({ restaurant: oldRestaurant._id }),
    Outlet.deleteMany({ restaurant: oldRestaurant._id }),
    Category.deleteMany({ restaurant: oldRestaurant._id }),
    Food.deleteMany({ restaurant: oldRestaurant._id }),
    KotTicket.deleteMany({ restaurant: oldRestaurant._id }),
    Table.deleteMany({ restaurant: oldRestaurant._id }),
    Order.deleteMany({ restaurant: oldRestaurant._id }),
    Subscription.deleteMany({ restaurant: oldRestaurant._id }),
  ]);
  await Restaurant.deleteOne({ _id: oldRestaurant._id });
}

const restaurant = await Restaurant.create({
  name: "Browser Role Matrix Restaurant",
  slug,
  branchCode: "BRM001",
  address: "Test-only address",
});
const outlet = await Outlet.create({ restaurant: restaurant._id, name: "Main Test Outlet", code: "MAIN", isDefault: true });
const category = await Category.create({ restaurant: restaurant._id, name: "Test Kitchen", slug: "test-kitchen" });
const foods = await Food.create([
  { restaurant: restaurant._id, category: category._id, name: "Paneer Tikka", price: 280 },
  { restaurant: restaurant._id, category: category._id, name: "Masala Dosa", price: 180 },
  { restaurant: restaurant._id, category: category._id, name: "Gulab Jamun", price: 120 },
  { restaurant: restaurant._id, category: category._id, name: "Fresh Lime Soda", price: 90 },
]);
const table = await Table.create({ restaurant: restaurant._id, outlet: outlet._id, tableNumber: "12", capacity: 4, floor: "Ground", section: "Main" });
// Table 13 is intentionally shared by the stateful order/payment journeys;
// the seeded KDS order intentionally occupies table 12.
await Table.create({ restaurant: restaurant._id, outlet: outlet._id, tableNumber: "13", capacity: 4, floor: "Ground", section: "Main" });
// The final 422 scenario runs after stateful order journeys, so it must use a
// fixture table that those journeys never select.
await Table.create({ restaurant: restaurant._id, outlet: outlet._id, tableNumber: "14", capacity: 4, floor: "Ground", section: "Main" });
// Billing creates and pays its own order before the 422 scenario, so it also
// requires a fixture table that no other stateful scenario can occupy.
await Table.create({ restaurant: restaurant._id, outlet: outlet._id, tableNumber: "15", capacity: 4, floor: "Ground", section: "Main" });

await Subscription.create({
  restaurant: restaurant._id,
  planName: "Browser Verification",
  status: "active",
  startDate: new Date(),
  renewalDate: new Date(Date.now() + 86400000),
});

const users = await User.create([
  { fullName: "Browser Super Admin", email: "browser-super-admin@test.invalid", password, role: "super_admin" },
  { fullName: "Browser Kitchen Manager", email: "browser-kitchen-manager@test.invalid", password, role: "kitchen_manager", restaurant: restaurant._id, defaultOutlet: outlet._id, outletAccess: [{ outlet: outlet._id }] },
  { fullName: "Browser Cashier", email: "browser-cashier@test.invalid", password, role: "cashier", restaurant: restaurant._id, defaultOutlet: outlet._id, outletAccess: [{ outlet: outlet._id }] },
  { fullName: "Browser Manager", email: "browser-manager@test.invalid", password, role: "manager", restaurant: restaurant._id, defaultOutlet: outlet._id, outletAccess: [{ outlet: outlet._id }], allOutletsAccess: true },
  { fullName: "Browser Admin", email: "browser-admin@test.invalid", password, role: "admin", restaurant: restaurant._id, defaultOutlet: outlet._id, outletAccess: [{ outlet: outlet._id }] },
]);

const itemStatuses = ["NEW", "PREPARING", "READY", "SERVED"];
const items = foods.map((food, index) => ({
  menuItem: food._id,
  name: food.name,
  price: food.price,
  quantity: index + 1,
  subtotal: food.price * (index + 1),
  specialInstructions: index === 0 ? "Less spicy" : "",
  kitchenStatus: itemStatuses[index],
}));
const order = await Order.create({
  orderNumber: "BRM-1001",
  restaurant: restaurant._id,
  outlet: outlet._id,
  table: table._id,
  orderType: "DINE_IN",
  orderSource: "DINE_IN",
  items,
  subtotal: items.reduce((sum, item) => sum + item.subtotal, 0),
  total: items.reduce((sum, item) => sum + item.subtotal, 0),
  status: "PREPARING",
  kitchenStatus: "PREPARING",
  specialInstructions: "Browser fixture order",
});
await KotTicket.create({
  orderId: order._id,
  tableId: table._id,
  restaurant: restaurant._id,
  outlet: outlet._id,
  orderNumber: order.orderNumber,
  orderType: order.orderType,
  items: items.map((item, index) => ({ orderItemIndex: index, menuItem: item.menuItem, name: item.name, quantity: item.quantity, specialInstructions: item.specialInstructions, status: itemStatuses[index] })),
  status: "PREPARING",
});

console.log("Browser E2E fixture prepared in the isolated test database.");
await mongoose.disconnect();
