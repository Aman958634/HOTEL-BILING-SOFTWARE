import mongoose from "mongoose";

const settlementWebhookEventSchema = new mongoose.Schema(
  {
    eventKey: { type: String, required: true, unique: true, index: true, trim: true },
    settlementTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "SettlementTransaction", default: null, index: true },
    provider: { type: String, enum: ["CASHFREE"], default: "CASHFREE" },
    eventType: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("SettlementWebhookEvent", settlementWebhookEventSchema);
