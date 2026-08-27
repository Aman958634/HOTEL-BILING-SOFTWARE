import mongoose from "mongoose";

const schema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
  outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", default: null, index: true },
  table: { type: mongoose.Schema.Types.ObjectId, ref: "Table", required: true, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
  fromStatus: { type: String, required: true },
  toStatus: { type: String, required: true },
  reason: { type: String, required: true, trim: true, maxlength: 120 },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

schema.index({ restaurant: 1, table: 1, createdAt: -1 });
schema.index({ order: 1, createdAt: 1 });

export default mongoose.model("TableLifecycleEvent", schema);
