import dotenv from "dotenv";
import mongoose from "mongoose";
import Restaurant from "../models/Restaurant.js";
import Outlet from "../models/Outlet.js";
import Table from "../models/Table.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Inventory from "../models/Inventory.js";
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
  ]);
  console.log(`Backfilled outlet ${outlet.code} for ${restaurant.name}`);
}
await mongoose.disconnect();
