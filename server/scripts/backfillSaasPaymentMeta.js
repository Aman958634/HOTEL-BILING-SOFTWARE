import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);
const SaasPayment = (await import("../models/SaasPayment.js")).default;
const { getRazorpayClient } = await import("../services/paymentService.js");

const paid = await SaasPayment.find({ status: "paid", gatewayPaymentId: { $ne: null } });
const razorpay = getRazorpayClient();

for (const p of paid) {
  if (!p.paymentMethod && razorpay && p.gatewayPaymentId && !String(p.gatewayPaymentId).startsWith("test_")) {
    try {
      const rp = await razorpay.payments.fetch(p.gatewayPaymentId);
      p.paymentMethod = String(rp.method || "").toLowerCase() || null;
      console.log("enriched", p.gatewayPaymentId, p.paymentMethod);
    } catch (e) {
      console.log("enrich failed", p.gatewayPaymentId, e.message);
    }
  }
  if (!p.paidAt) p.paidAt = p.updatedAt || p.createdAt;
  await p.save();
  console.log({
    id: String(p._id),
    pay: p.gatewayPaymentId,
    method: p.paymentMethod,
    paidAt: p.paidAt,
    amount: p.amount,
  });
}

await mongoose.disconnect();
