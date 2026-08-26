import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    itemName: { type: String, required: true, trim: true, index: true },
    sku: { type: String, required: true, index: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, default: "kg" },
    baseUnit: { type: String, default: "" },
    minStock: { type: Number, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 10 },
    maxStock: { type: Number, default: null, min: 0 },
    costPerUnit: { type: Number, default: 0 },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null, index: true },
    category: { type: String, default: "Other", trim: true },
    storageLocation: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

inventorySchema.index({ restaurant: 1, sku: 1 }, { unique: true });

const Inventory = mongoose.model("Inventory", inventorySchema);
export default Inventory;
