import mongoose from "mongoose";

const logSchema = new mongoose.Schema(
  {
    level: { type: String, required: true, index: true },
    message: { type: String, required: true },
    context: { type: Object, default: {} },
  },
  { timestamps: true }
);

const Log = mongoose.model("Log", logSchema);
export default Log;
