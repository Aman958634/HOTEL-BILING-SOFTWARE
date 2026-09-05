import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    suppliedItems: [{ type: mongoose.Schema.Types.ObjectId, ref: "Inventory" }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

supplierSchema.index({ restaurant: 1, name: 1 });

const Supplier = mongoose.model("Supplier", supplierSchema);
export default Supplier;
