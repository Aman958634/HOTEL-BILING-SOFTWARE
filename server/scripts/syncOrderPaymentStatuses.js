import dotenv from "dotenv";
import mongoose from "mongoose";
import { reconcilePaymentSettlements } from "../services/paymentService.js";

dotenv.config();

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");

await mongoose.connect(mongoUri);

try {
  // The service derives each order's mirror status from successful payment
  // ledger entries inside a transaction. It is safe to re-run.
  const reconciled = await reconcilePaymentSettlements();
  console.log(`Synchronized ${reconciled} order payment status record(s).`);
} finally {
  await mongoose.disconnect();
}
