import mongoose from "mongoose";

const socketEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    event: { type: String, required: true, trim: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", default: null, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    occurredAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

socketEventSchema.index({ restaurant: 1, occurredAt: 1, _id: 1 });
export default mongoose.model("SocketEvent", socketEventSchema);
