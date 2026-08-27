import mongoose from "mongoose";

const kotItemSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: "Food", required: true },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    specialInstructions: { type: String, default: "", trim: true },
    kitchenStatus: { type: String, enum: ["NEW", "PREPARING", "READY", "SERVED", "CANCELLED"], default: "NEW" },
  },
  { _id: false }
);

const kotTicketSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    revision: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["NEW", "PREPARING", "READY", "SERVED", "CANCELLED"], default: "NEW", index: true },
    items: { type: [kotItemSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

kotTicketSchema.index({ restaurant: 1, order: 1, revision: 1 }, { unique: true });
kotTicketSchema.index({ restaurant: 1, outlet: 1, status: 1, createdAt: 1 });
kotTicketSchema.index({ restaurant: 1, status: 1, createdAt: 1 });

export default mongoose.model("KotTicket", kotTicketSchema);
