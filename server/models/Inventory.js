import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    itemName: { type: String, required: true, trim: true, index: true },
    sku: { type: String, required: true, index: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, default: "kg", trim: true },
    baseUnit: { type: String, default: "kg", trim: true },
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

// Validate that unit and baseUnit don't contain numbers (prevent "10kg" format)
inventorySchema.pre("save", function (next) {
  if (this.unit && /\d/.test(this.unit)) {
    return next(new Error("Unit field cannot contain numbers. Use separate quantity field for stock value."));
  }
  if (this.baseUnit && /\d/.test(this.baseUnit)) {
    return next(new Error("Base unit field cannot contain numbers. Unit should only contain the measurement type (e.g., 'kg', 'g', 'ml')."));
  }
  next();
});

// Post-find hook to ensure baseUnit is properly set
inventorySchema.post("find", function (docs) {
  if (Array.isArray(docs)) {
    docs.forEach((doc) => {
      if (doc && !doc.baseUnit) {
        doc.baseUnit = doc.unit || "kg";
      }
    });
  }
});

inventorySchema.post("findOne", function (doc) {
  if (doc && !doc.baseUnit) {
    doc.baseUnit = doc.unit || "kg";
  }
});

const Inventory = mongoose.model("Inventory", inventorySchema);
export default Inventory;
