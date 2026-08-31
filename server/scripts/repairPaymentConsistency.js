import dotenv from "dotenv";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import { deriveOrderPaymentState } from "../services/paymentService.js";

dotenv.config();

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGO_URI (or MONGODB_URI) is missing");
const apply = process.argv.includes("--apply");

await mongoose.connect(mongoUri);

try {
  const orders = await Order.find({ isArchived: { $ne: true } })
    .select("_id orderNumber total paymentStatus paymentId transactionId paidAt billingBill status")
    .lean();
  let repaired = 0;
  let manualReview = 0;

  for (const order of orders) {
    if (order.billingBill) {
      manualReview += 1;
      console.log(JSON.stringify({ orderId: String(order._id), action: "MANUAL_FINANCIAL_REVIEW_REQUIRED", reason: "Bill-linked allocation requires bill settlement review" }));
      continue;
    }
    const payments = await Payment.find({ orderId: order._id }).select("paymentId transactionId paymentStatus paidAt").sort({ paidAt: -1, createdAt: -1 }).lean();
    const settlement = await deriveOrderPaymentState(order);
    if (settlement.paymentStatus === order.paymentStatus) continue;
    if (!payments.length) {
      manualReview += 1;
      console.log(JSON.stringify({ orderId: String(order._id), action: "MANUAL_FINANCIAL_REVIEW_REQUIRED", reason: "No authoritative payment record" }));
      continue;
    }
    const latest = payments[0];
    const change = { orderId: String(order._id), from: order.paymentStatus, to: settlement.paymentStatus, collectedAmount: settlement.collectedAmount, mode: apply ? "APPLY" : "DRY_RUN" };
    console.log(JSON.stringify(change));
    if (!apply) continue;
    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          paymentStatus: settlement.paymentStatus,
          paymentId: latest.paymentId || order.paymentId || "",
          transactionId: latest.transactionId || order.transactionId || "",
          paidAt: settlement.fullyPaid ? latest.paidAt || order.paidAt || new Date() : null,
          ...(settlement.fullyPaid ? { status: "COMPLETED" } : {}),
        },
      }
    );
    repaired += 1;
  }
  console.log(JSON.stringify({ mode: apply ? "APPLY" : "DRY_RUN", repaired, manualFinancialReviewRequired: manualReview }));
} finally {
  await mongoose.disconnect();
}
