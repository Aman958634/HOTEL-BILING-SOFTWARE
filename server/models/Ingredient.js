import mongoose from "mongoose";

const ingredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory", required: true },
    food: { type: mongoose.Schema.Types.ObjectId, ref: "Food", required: true, index: true },
    quantityRequired: { type: Number, required: true, min: 0 },
    unit: { type: String, default: "g" },
  },
  { timestamps: true }
);

const Ingredient = mongoose.model("Ingredient", ingredientSchema);
export default Ingredient;
