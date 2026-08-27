import dotenv from "dotenv";
import mongoose from "mongoose";
import Restaurant from "../models/Restaurant.js";
import Outlet from "../models/Outlet.js";
import Table from "../models/Table.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Inventory from "../models/Inventory.js";
import User from "../models/User.js";
import KotTicket from "../models/KotTicket.js";
import Analytics from "../models/Analytics.js";
import Food from "../models/Food.js";
import KitchenStation from "../models/KitchenStation.js";
import Notification from "../models/Notification.js";
import Recipe from "../models/Recipe.js";
import Reservation from "../models/Reservation.js";
import Staff from "../models/Staff.js";
import StockMovement from "../models/StockMovement.js";
import TableLifecycleEvent from "../models/TableLifecycleEvent.js";
import Subscription from "../models/Subscription.js";
import SaasPayment from "../models/SaasPayment.js";
import Supplier from "../models/Supplier.js";
import SocketEvent from "../models/SocketEvent.js";
import connectDB from "../config/db.js";

dotenv.config();
await connectDB();
for await (const restaurant of Restaurant.find({}).select("_id name branchCode")) {
  const outlet = await Outlet.findOneAndUpdate(
    { restaurant: restaurant._id, code: "MAIN" },
    { $setOnInsert: { restaurant: restaurant._id, name: `${restaurant.name} Main Outlet`, code: "MAIN" } },
    { upsert: true, new: true }
  );
  const filter = { restaurant: restaurant._id, outlet: null };
  await Promise.all([
    Table.updateMany(filter, { $set: { outlet: outlet._id } }),
    Order.updateMany(filter, { $set: { outlet: outlet._id } }),
    Payment.updateMany(filter, { $set: { outlet: outlet._id } }),
    Inventory.updateMany(filter, { $set: { outlet: outlet._id } }),
    User.updateMany({ restaurant: restaurant._id, outlet: null }, { $set: { outlet: outlet._id } }),
    KotTicket.updateMany({ restaurant: restaurant._id, outlet: null }, { $set: { outlet: outlet._id } }),
    Analytics.updateMany({ restaurant: restaurant._id, outlet: null }, { $set: { outlet: outlet._id } }),
    Food.updateMany({ restaurant: restaurant._id, outlet: null }, { $set: { outlet: outlet._id } }),
    KitchenStation.updateMany({ restaurant: restaurant._id, outlet: null }, { $set: { outlet: outlet._id } }),
    Notification.updateMany({ restaurant: restaurant._id, outlet: null }, { $set: { outlet: outlet._id } }),
    Recipe.updateMany({ restaurant: restaurant._id, outlet: null }, { $set: { outlet: outlet._id } }),
    Reservation.updateMany({ restaurant: restaurant._id, outlet: null }, { $set: { outlet: outlet._id } }),
    Staff.updateMany({ restaurant: restaurant._id, outlet: null }, { $set: { outlet: outlet._id } }),
    StockMovement.updateMany({ restaurant: restaurant._id, outlet: null }, { $set: { outlet: outlet._id } }),
    TableLifecycleEvent.updateMany({ restaurant: restaurant._id, outlet: null }, { $set: { outlet: outlet._id } }),
    Subscription.updateMany({ restaurant: restaurant._id, outlet: null }, { $set: { outlet: outlet._id } }),
    SaasPayment.updateMany({ restaurant: restaurant._id, outlet: null }, { $set: { outlet: outlet._id } }),
    Supplier.updateMany({ restaurant: restaurant._id, outlet: null }, { $set: { outlet: outlet._id } }),
    SocketEvent.updateMany({ restaurant: restaurant._id, outlet: null }, { $set: { outlet: outlet._id } }),
  ]);
  console.log(`Backfilled outlet ${outlet.code} for ${restaurant.name}`);
}
await mongoose.disconnect();
