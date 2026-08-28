import dotenv from "dotenv";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";

dotenv.config();

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");

await mongoose.connect(mongoUri);

try {
  const indexes = await Payment.collection.indexes();
  const uniqueOrderIndex = indexes.find(
    (index) => index.unique && index.key?.orderId === 1 && Object.keys(index.key).length === 1
  );

  if (uniqueOrderIndex?.name) {
    await Payment.collection.dropIndex(uniqueOrderIndex.name);
    console.log(`Dropped unique payment index: ${uniqueOrderIndex.name}`);
  }

  await Payment.collection.createIndex({ orderId: 1 }, { name: "orderId_1" });
  console.log("Payment orderId index is now non-unique.");
} finally {
  await mongoose.disconnect();
}