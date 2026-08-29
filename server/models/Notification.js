import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: false, index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", default: null, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    eventType: { type: String, default: "SYSTEM", index: true },
    category: { type: String, default: "SYSTEM", index: true },
    severity: { type: String, enum: ["INFO", "SUCCESS", "WARNING", "CRITICAL"], default: "INFO", index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "order",
        "reservation",
        "payment",
        "system",
        "NEW_ORDER",
        "PAYMENT_RECEIVED",
        "ORDER_CANCELLED",
        "SUBSCRIPTION_EXPIRING",
        "LOW_STOCK",
        "NEW_STAFF",
        "ORDER_CREATED",
        "ONLINE_ORDER_RECEIVED",
        "KOT_CREATED",
        "KOT_READY",
        "CUSTOMER_CREATED",
        "STAFF_CREATED",
        "BILL_GENERATED",
        "PARTIAL_PAYMENT_RECEIVED",
        "BILL_FULLY_PAID",
        "REFUND_CREATED",
        "REFUND_COMPLETED",
        "LOYALTY_MEMBER_ENROLLED",
        "INVENTORY_LOW",
        "INVENTORY_OUT_OF_STOCK",
        "RECONCILIATION_MISMATCH",
        "INTELLIGENCE_ALERT_CREATED",
      ],
      default: "system",
      index: true,
    },
    entityType: { type: String, required: false, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: false, index: true },
    route: { type: String, default: "" },
    dedupeKey: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ restaurantId: 1, createdAt: -1 });
notificationSchema.index({ user: 1, type: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ user: 1, dedupeKey: 1 }, { unique: true, sparse: true });
notificationSchema.index({ entityType: 1, entityId: 1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
