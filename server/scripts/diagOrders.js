import dotenv from "dotenv";
import mongoose from "mongoose";
import Order from "../models/Order.js";

dotenv.config();

const BOARD = ["PENDING", "CONFIRMED", "PREPARING", "READY", "SERVED", "COMPLETED"];

await mongoose.connect(process.env.MONGO_URI);

const total = await Order.countDocuments({});
const notArchivedStrict = await Order.countDocuments({ isArchived: false });
const notArchivedLoose = await Order.countDocuments({ isArchived: { $ne: true } });
const boardStrict = await Order.countDocuments({
  isArchived: false,
  status: { $in: BOARD },
});
const boardLoose = await Order.countDocuments({
  isArchived: { $ne: true },
  status: { $in: BOARD },
});
const noRestaurant = await Order.countDocuments({
  isArchived: { $ne: true },
  $or: [{ restaurant: null }, { restaurant: { $exists: false } }],
});
const statuses = await Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
const archived = await Order.aggregate([{ $group: { _id: "$isArchived", count: { $sum: 1 } } }]);
const sample = await Order.find({ isArchived: { $ne: true } })
  .select("orderNumber status isArchived restaurant createdAt")
  .sort({ createdAt: -1 })
  .limit(5)
  .lean();

console.log(
  JSON.stringify(
    {
      total,
      notArchivedStrict,
      notArchivedLoose,
      boardStrict,
      boardLoose,
      noRestaurant,
      statuses,
      archived,
      sample,
    },
    null,
    2
  )
);

await mongoose.disconnect();
