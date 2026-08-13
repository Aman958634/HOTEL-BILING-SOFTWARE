import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    itemName: { type: String, required: true, trim: true, index: true },
    sku: { type: String, required: true, index: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, default: "kg" },
    reorderLevel: { type: Number, default: 10 },
    costPerUnit: { type: Number, default: 0 },
  },
  { timestamps: true }
);

inventorySchema.index({ restaurant: 1, sku: 1 }, { unique: true });

const Inventory = mongoose.model("Inventory", inventorySchema);
export default Inventory;
