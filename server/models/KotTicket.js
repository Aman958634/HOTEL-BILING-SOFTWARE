import mongoose from "mongoose";

const KOT_ITEM_STATUSES = ["NEW", "PREPARING", "READY", "SERVED", "CANCELLED"];
const KOT_STATUSES = ["NEW", "PREPARING", "READY", "SERVED", "CANCELLED"];

const kotItemSchema = new mongoose.Schema(
  {
    orderItemIndex: { type: Number, required: true, min: 0 },
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: "Food", required: false },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    specialInstructions: { type: String, default: "" },
    status: { type: String, enum: KOT_ITEM_STATUSES, default: "NEW", index: true },
  },
  { _id: false }
);

const kotTicketSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: "Table", default: null, index: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", default: null, index: true },
    orderNumber: { type: String, required: true, index: true },
    orderType: { type: String, default: "DINE_IN" },
    assignedChef: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null, index: true },
    items: { type: [kotItemSchema], default: [] },
    status: { type: String, enum: KOT_STATUSES, default: "NEW", index: true },
  },
  { timestamps: true }
);

kotTicketSchema.index({ restaurant: 1, status: 1, createdAt: -1 });
kotTicketSchema.index({ restaurant: 1, orderNumber: 1 });

const KotTicket = mongoose.model("KotTicket", kotTicketSchema);
export default KotTicket;
