import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: false, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
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
        "NEW_RESERVATION",
      ],
      default: "system",
      index: true,
    },
    entityType: { type: String, required: false, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: false, index: true },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ restaurantId: 1, createdAt: -1 });
notificationSchema.index({ user: 1, type: 1, createdAt: -1 });
notificationSchema.index({ entityType: 1, entityId: 1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
