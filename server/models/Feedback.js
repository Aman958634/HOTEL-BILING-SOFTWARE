import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    food: { type: mongoose.Schema.Types.ObjectId, ref: "Food" },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "" },
  },
  { timestamps: true }
);

const Feedback = mongoose.model("Feedback", feedbackSchema);
export default Feedback;
