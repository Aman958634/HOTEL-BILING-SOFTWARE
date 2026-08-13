import mongoose from "mongoose";

const deliverySchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["assigned", "picked", "on_the_way", "delivered"], default: "assigned", index: true },
    assignedAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date },
  },
  { timestamps: true }
);

const Delivery = mongoose.model("Delivery", deliverySchema);
export default Delivery;
