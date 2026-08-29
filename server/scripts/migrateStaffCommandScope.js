import dotenv from "dotenv";
import mongoose from "mongoose";
import Staff from "../models/Staff.js";
import User from "../models/User.js";

dotenv.config();
const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");

await mongoose.connect(uri);
try {
  const operations = [];
  const cursor = Staff.find({ restaurant: null, user: { $ne: null } }).select("user hotelId").lean().cursor();
  for await (const staff of cursor) {
    const user = await User.findById(staff.user).select("restaurant hotelId").lean();
    // Scope only when the linked authenticated identity establishes it. Do not
    // assign ambiguous legacy records to whichever restaurant runs the script.
    if (!user?.restaurant && !user?.hotelId) continue;
    operations.push({ updateOne: { filter: { _id: staff._id, restaurant: null }, update: { $set: { restaurant: user.restaurant || null, hotelId: user.hotelId || staff.hotelId || null } } } });
    if (operations.length >= 500) { await Staff.bulkWrite(operations); operations.length = 0; }
  }
  if (operations.length) await Staff.bulkWrite(operations);
  await Staff.syncIndexes();
  console.log("Staff Command Center scope and indexes migrated successfully.");
} finally {
  await mongoose.disconnect();
}
