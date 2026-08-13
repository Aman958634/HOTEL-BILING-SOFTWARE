import mongoose from "mongoose";

const reservationSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    table: { type: mongoose.Schema.Types.ObjectId, ref: "Table", required: true, index: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    date: { type: Date, required: true, index: true },
    guests: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["pending", "confirmed", "cancelled", "completed"], default: "pending", index: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

const Reservation = mongoose.model("Reservation", reservationSchema);
export default Reservation;
