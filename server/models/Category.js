import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    active: { type: Boolean, default: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

categorySchema.pre("save", function syncStatus(next) {
  this.isActive = this.active;
  next();
});

const Category = mongoose.model("Category", categorySchema);
export default Category;
