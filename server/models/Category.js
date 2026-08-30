import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", default: null, index: true },
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    active: { type: Boolean, default: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

categorySchema.index({ restaurant: 1, slug: 1 }, { unique: true });
categorySchema.index({ restaurant: 1, isActive: 1, name: 1 });

categorySchema.pre("save", function syncStatus(next) {
  this.isActive = this.active;
  next();
});

const Category = mongoose.model("Category", categorySchema);
export default Category;
