import mongoose from "mongoose";

const recipeIngredientSchema = new mongoose.Schema(
  {
    inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true },
  },
  { _id: true }
);

const recipeSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    // Null means a customer-order recipe. A set value marks a production-only
    // recipe for that central kitchen and keeps it out of normal order usage.
    centralKitchen: { type: mongoose.Schema.Types.ObjectId, ref: "CentralKitchen", default: null, index: true },
    food: { type: mongoose.Schema.Types.ObjectId, ref: "Food", required: true, index: true },
    name: { type: String, required: true, trim: true },
    version: { type: Number, required: true, min: 1, default: 1 },
    status: { type: String, enum: ["DRAFT", "ACTIVE", "INACTIVE"], default: "DRAFT", index: true },
    ingredients: { type: [recipeIngredientSchema], required: true, validate: [(value) => value.length > 0, "Recipe requires an ingredient"] },
    yieldQuantity: { type: Number, min: 0, default: 1 },
    yieldUnit: { type: String, default: "portion", trim: true },
    portionSize: { type: Number, min: 0, default: 1 },
    preparationNotes: { type: String, default: "", trim: true },
    wastagePercent: { type: Number, min: 0, max: 100, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

recipeSchema.index({ restaurant: 1, centralKitchen: 1, food: 1, status: 1 });
recipeSchema.index({ restaurant: 1, centralKitchen: 1, food: 1, version: 1 }, { unique: true });

const Recipe = mongoose.model("Recipe", recipeSchema);
export default Recipe;
