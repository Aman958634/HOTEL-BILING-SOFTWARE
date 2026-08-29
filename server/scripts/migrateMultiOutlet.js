import dotenv from "dotenv";
import mongoose from "mongoose";
import Restaurant from "../models/Restaurant.js";
import Outlet from "../models/Outlet.js";
import User from "../models/User.js";
import Table from "../models/Table.js";
import Order from "../models/Order.js";
import Bill from "../models/Bill.js";
import Payment from "../models/Payment.js";
import Inventory from "../models/Inventory.js";
import KotTicket from "../models/KotTicket.js";
import Staff from "../models/Staff.js";
import StockMovement from "../models/StockMovement.js";
import Reservation from "../models/Reservation.js";
import Notification from "../models/Notification.js";

dotenv.config();
const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");
await mongoose.connect(uri);
try {
  const models = [Table, Order, Bill, Payment, Inventory, KotTicket, Staff, StockMovement, Reservation, Notification];
  for (const restaurant of await Restaurant.find().lean()) {
    let outlet = await Outlet.findOne({ restaurant: restaurant._id }).sort({ isDefault: -1, createdAt: 1 });
    if (!outlet) outlet = await Outlet.create({ restaurant: restaurant._id, name: "Main Outlet", code: "MAIN", address: restaurant.address || "", city: restaurant.city || "", state: restaurant.state || "", phone: restaurant.phone || "", email: restaurant.email || "", timeZone: restaurant.timeZone || "Asia/Kolkata", gstNumber: restaurant.gstNumber || "", isDefault: true });
    await Promise.all(models.map((Model) => Model.updateMany({ restaurant: restaurant._id, outlet: null }, { $set: { outlet: outlet._id } })));
    await User.updateMany({ restaurant: restaurant._id, defaultOutlet: null, role: { $ne: "customer" } }, { $set: { defaultOutlet: outlet._id } });
  }
  await Promise.all([Outlet.syncIndexes(), Table.syncIndexes(), Order.syncIndexes(), Bill.syncIndexes(), Payment.syncIndexes(), Inventory.syncIndexes(), KotTicket.syncIndexes(), Staff.syncIndexes(), StockMovement.syncIndexes(), Reservation.syncIndexes(), Notification.syncIndexes(), User.syncIndexes()]);
  console.log("Multi-outlet migration completed successfully.");
} finally { await mongoose.disconnect(); }
