import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    phone: { type: String, required: true },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    suppliedItems: [{ type: mongoose.Schema.Types.ObjectId, ref: "Inventory" }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Supplier = mongoose.model("Supplier", supplierSchema);
export default Supplier;
