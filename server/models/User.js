import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true, index: true },
    password: { type: String, required: true, minlength: 8, select: false },
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: false,
      index: true,
      default: null,
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: false,
      index: true,
      default: null,
    },
    role: {
      type: String,
      enum: ["super_admin", "hotel_admin", "restaurant_admin", "manager", "staff", "cashier", "admin", "chef", "waiter", "delivery", "receptionist", "inventory_manager", "customer"],
      default: "customer",
      index: true,
    },
    avatar: { type: String, default: "" },
    address: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    refreshToken: { type: String, default: "" },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
