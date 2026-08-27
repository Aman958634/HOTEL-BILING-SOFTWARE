import mongoose from "mongoose";

const staffSchema = new mongoose.Schema(
  {
    employeeId: { type: String, unique: true, required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, unique: true, sparse: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    profilePhoto: { type: String, default: "" },
    phone: { type: String, required: true, trim: true, unique: true, index: true },
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true, index: true },
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", default: null, index: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", default: null, index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", default: null, index: true },
    role: {
      type: String,
      enum: ["ADMIN", "MANAGER", "CHEF", "WAITER", "DELIVERY", "CASHIER", "RECEPTIONIST", "INVENTORY_MANAGER"],
      required: true,
      index: true,
    },
    department: {
      type: String,
      enum: ["Management", "Kitchen", "Service", "Delivery", "Billing", "Reception", "Inventory"],
      required: true,
      index: true,
    },
    shift: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", default: null, index: true },
    joiningDate: { type: Date, required: true, index: true },
    salary: { type: Number, default: 0, min: 0 },
    address: { type: String, default: "" },
    emergencyContact: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      relationship: { type: String, default: "" },
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "ON_LEAVE", "SUSPENDED"],
      default: "ACTIVE",
      index: true,
    },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true }
);

const Staff = mongoose.model("Staff", staffSchema);
export default Staff;
