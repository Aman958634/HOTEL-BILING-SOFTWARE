import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    // Most counters remain global; order numbers supply this scope so every
    // restaurant owns an independent, persistent business-number sequence.
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", default: null },
    seq: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

counterSchema.index({ key: 1, restaurant: 1 }, { unique: true });

export default mongoose.model("Counter", counterSchema);
