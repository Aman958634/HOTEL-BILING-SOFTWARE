import mongoose from "mongoose";

const ORDER_TYPES = ["DINE_IN", "TAKEAWAY", "DELIVERY"];
const PAYMENT_METHODS = ["CASH", "UPI", "CREDIT_CARD", "DEBIT_CARD", "RAZORPAY", "OTHER"];
const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];
const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY", "SERVED", "COMPLETED", "CANCELLED"];

const orderTypeAliases = {
  dine_in: "DINE_IN",
  takeaway: "TAKEAWAY",
  delivery: "DELIVERY",
};

const paymentMethodAliases = {
  cash: "CASH",
  upi: "UPI",
  card: "CREDIT_CARD",
  credit_card: "CREDIT_CARD",
  debit_card: "DEBIT_CARD",
  online: "RAZORPAY",
  stripe: "RAZORPAY",
  razorpay: "RAZORPAY",
  wallet: "OTHER",
  other: "OTHER",
};

const paymentStatusAliases = {
  pending: "PENDING",
  paid: "PAID",
  failed: "FAILED",
  refunded: "REFUNDED",
  partially_refunded: "PARTIALLY_REFUNDED",
  success: "PAID",
};

const orderStatusAliases = {
  pending: "PENDING",
  confirmed: "CONFIRMED",
  preparing: "PREPARING",
  ready: "READY",
  served: "SERVED",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
  placed: "PENDING",
  accepted: "CONFIRMED",
  delivered: "COMPLETED",
  out_for_delivery: "READY",
};

const normalizeAlias = (value, aliases, fallback) => {
  if (!value) return fallback;
  const upper = String(value).trim().toUpperCase();
  if (Object.values(aliases).includes(upper)) return upper;
  return aliases[String(value).trim().toLowerCase()] || upper;
};

const orderItemSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: "Food", required: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 0 },
    specialInstructions: { type: String, default: "" },
    kitchenStatus: {
      type: String,
      enum: ["NEW", "PREPARING", "READY", "SERVED", "CANCELLED"],
      default: "NEW",
    },
  },
  { _id: false, timestamps: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false, timestamps: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false, index: true },
    table: { type: mongoose.Schema.Types.ObjectId, ref: "Table", default: null, index: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: false, index: true },
    orderType: {
      type: String,
      enum: ORDER_TYPES,
      required: true,
      default: "DINE_IN",
      set: (value) => normalizeAlias(value, orderTypeAliases, "DINE_IN"),
      index: true,
    },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    serviceCharge: { type: Number, default: 0, min: 0 },
    deliveryCharge: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      default: "CASH",
      set: (value) => normalizeAlias(value, paymentMethodAliases, "CASH"),
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "PENDING",
      set: (value) => normalizeAlias(value, paymentStatusAliases, "PENDING"),
      index: true,
    },
    paymentId: { type: String, default: "", trim: true, index: true },
    transactionId: { type: String, default: "", trim: true, index: true, sparse: true },
    paidAt: { type: Date, default: null, index: true },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "PENDING",
      set: (value) => normalizeAlias(value, orderStatusAliases, "PENDING"),
      index: true,
    },
    kitchenStatus: {
      type: String,
      enum: ["PENDING", "PREPARING", "READY", "COMPLETED"],
      default: "PENDING",
      index: true,
    },
    specialInstructions: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    statusHistory: { type: [statusHistorySchema], default: [] },
    isArchived: { type: Boolean, default: false, index: true },
    deliveryAddress: { type: String, default: "" },
    billingState: { type: String, default: "", trim: true, index: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });
orderSchema.index({ orderType: 1, createdAt: -1 });

orderSchema.pre("validate", function normalizeLegacyOrder(next) {
  if (!this.orderType) {
    this.orderType = this.table ? "DINE_IN" : "TAKEAWAY";
  }

  if (this.items?.length) {
    this.items = this.items.map((item) => {
      const menuItem = item.menuItem || item.food || null;
      const quantity = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      const subtotal = Number(item.subtotal || price * quantity || 0);

      return {
        menuItem,
        name: item.name || item.food?.name || "Menu Item",
        price,
        quantity,
        subtotal,
        specialInstructions: item.specialInstructions || "",
        kitchenStatus: item.kitchenStatus || "NEW",
      };
    });
  }

  if (!this.specialInstructions && this.notes) {
    this.specialInstructions = this.notes;
  }

  next();
});

const Order = mongoose.model("Order", orderSchema);
export default Order;
