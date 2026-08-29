import mongoose from "mongoose";

const MOVEMENT_TYPES = [
  "OPENING_STOCK", "PURCHASE", "PURCHASE_RETURN", "CONSUMPTION", "WASTAGE",
  "DAMAGE", "ADJUSTMENT", "TRANSFER_IN", "TRANSFER_OUT", "PRODUCTION_CONSUMPTION", "PRODUCTION_OUTPUT", "STOCK_COUNT", "RETURN", "REVERSAL",
];

const stockMovementSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", default: null, index: true },
    centralKitchen: { type: mongoose.Schema.Types.ObjectId, ref: "CentralKitchen", default: null, index: true },
    inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", required: true, index: true },
    movementType: { type: String, enum: MOVEMENT_TYPES, required: true, index: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true, trim: true },
    previousStock: { type: Number, required: true, min: 0 },
    newStock: { type: Number, required: true, min: 0 },
    referenceType: { type: String, default: "", trim: true },
    referenceId: { type: String, default: "", trim: true },
    idempotencyKey: { type: String, default: "", trim: true },
    reason: { type: String, default: "", trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

stockMovementSchema.index({ restaurant: 1, createdAt: -1 });
stockMovementSchema.index({ restaurant: 1, centralKitchen: 1, createdAt: -1 });
stockMovementSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

const StockMovement = mongoose.model("StockMovement", stockMovementSchema);
export default StockMovement;
