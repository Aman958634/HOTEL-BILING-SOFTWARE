import mongoose from "mongoose";

const foodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", default: null, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", default: null, index: true },
    description: { type: String, default: "", maxlength: 1200 },
    image: { type: String, default: "" },
    price: { type: Number, required: true, min: 0, index: true },
    discountPrice: { type: Number, default: 0, min: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    prepTimeMins: { type: Number, default: 20 },
    preparationTime: { type: Number, default: 20, min: 1 },
    ingredients: [{ type: String, trim: true }],
    spicyLevel: {
      type: String,
      enum: ["mild", "medium", "hot", "extra_hot"],
      default: "mild",
      index: true,
    },
    foodType: {
      type: String,
      enum: ["vegetarian", "non_vegetarian"],
      default: "vegetarian",
      index: true,
    },
    isVeg: { type: Boolean, default: true, index: true },
    isAvailable: { type: Boolean, default: true, index: true },
    available: { type: Boolean, default: true, index: true },
    featured: { type: Boolean, default: false, index: true },
    tags: [{ type: String }],
    kitchenStation: { type: mongoose.Schema.Types.ObjectId, ref: "KitchenStation", default: null, index: true },
  },
  { timestamps: true }
);

foodSchema.index({ name: "text", description: "text" });

foodSchema.pre("save", function syncCompatibility(next) {
  if (this.preparationTime !== undefined) {
    this.prepTimeMins = this.preparationTime;
  } else {
    this.preparationTime = this.prepTimeMins;
  }

  if (this.foodType === "non_vegetarian") {
    this.isVeg = false;
  }
  if (this.foodType === "vegetarian") {
    this.isVeg = true;
  }

  this.available = this.isAvailable;
  next();
});

const Food = mongoose.model("Food", foodSchema);
export default Food;
