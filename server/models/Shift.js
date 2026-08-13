import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, index: true },
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

const Shift = mongoose.model("Shift", shiftSchema);
export default Shift;