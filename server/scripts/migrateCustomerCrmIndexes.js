import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";

dotenv.config();

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");

await mongoose.connect(uri);

try {
  const operations = [];
  const cursor = User.find({ phone: { $type: "string", $ne: "" } }).select("phone").lean().cursor();
  for await (const user of cursor) {
    const phoneNormalized = String(user.phone).replace(/\D/g, "");
    if (phoneNormalized) operations.push({ updateOne: { filter: { _id: user._id }, update: { $set: { phoneNormalized } } } });
    if (operations.length === 500) {
      await User.bulkWrite(operations);
      operations.length = 0;
    }
  }
  if (operations.length) await User.bulkWrite(operations);

  const indexes = await User.collection.indexes();
  const emailIndex = indexes.find((index) => index.name === "email_1");
  if (emailIndex && (!emailIndex.sparse || !emailIndex.unique)) {
    await User.collection.dropIndex(emailIndex.name);
  }
  await User.collection.createIndex({ email: 1 }, { name: "email_1", unique: true, sparse: true });
  await User.syncIndexes();
  console.log("Customer CRM indexes migrated successfully.");
} finally {
  await mongoose.disconnect();
}
