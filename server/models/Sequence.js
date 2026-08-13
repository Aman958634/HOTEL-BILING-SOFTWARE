import mongoose from "mongoose";

const sequenceSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Number, default: 1000 },
  },
  { timestamps: true }
);

const Sequence = mongoose.model("Sequence", sequenceSchema);
export default Sequence;