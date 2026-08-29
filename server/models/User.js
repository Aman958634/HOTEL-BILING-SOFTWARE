import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    // Restaurant customers may be identified by a phone number only. Staff and
    // login-capable users still require an email through their request validators.
    email: { type: String, required: function requiredEmail() { return this.role !== "customer"; }, unique: true, sparse: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true, index: true },
    phoneNormalized: { type: String, trim: true, index: true },
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
    customerRestaurants: [
      {
        restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    tags: [
      {
        restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
        name: { type: String, required: true, trim: true, maxlength: 80 },
      },
    ],
    customerNotes: [
      {
        text: { type: String, required: true, trim: true, maxlength: 1000 },
        restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isCrmArchived: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    refreshToken: { type: String, default: "" },
  },
  { timestamps: true }
);

userSchema.index({ "customerRestaurants.restaurant": 1, phoneNormalized: 1 });
userSchema.index({ "customerRestaurants.restaurant": 1, createdAt: -1 });
userSchema.index({ "tags.restaurant": 1, "tags.name": 1 });

userSchema.pre("validate", function normalizeCustomerPhone(next) {
  if (this.phone) this.phoneNormalized = String(this.phone).replace(/\D/g, "");
  next();
});

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
