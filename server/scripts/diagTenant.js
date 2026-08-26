import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";
import Restaurant from "../models/Restaurant.js";
import Order from "../models/Order.js";
import Subscription from "../models/Subscription.js";
import { buildRestaurantQuery } from "../utils/tenantUtils.js";

dotenv.config();
await mongoose.connect(process.env.MONGO_URI);

const admins = await User.find({ role: { $in: ["admin", "restaurant_admin"] } })
  .select("email role restaurant hotelId")
  .lean();
const restaurants = await Restaurant.find({}).select("_id name hotelId").lean();

for (const admin of admins) {
  const base = await buildRestaurantQuery({}, admin);
  const count = await Order.countDocuments({
    ...base,
    isArchived: false,
    status: { $in: ["PENDING", "CONFIRMED", "PREPARING", "READY", "SERVED", "COMPLETED"] },
  });
  const sub = admin.restaurant
    ? await Subscription.findOne({ restaurant: admin.restaurant }).select("status").lean()
    : null;
  console.log({
    email: admin.email,
    restaurant: String(admin.restaurant || ""),
    hotelId: String(admin.hotelId || ""),
    matchedOrders: count,
    subscription: sub?.status || "none",
    query: base,
  });
}

console.log("restaurants", restaurants);
await mongoose.disconnect();
