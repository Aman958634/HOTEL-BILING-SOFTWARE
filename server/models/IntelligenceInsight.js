import mongoose from "mongoose";

const evidenceSchema = new mongoose.Schema({
  metric: { type: String, required: true, trim: true },
  current: { type: Number, default: null },
  baseline: { type: Number, default: null },
  change: { type: Number, default: null },
  unit: { type: String, default: "number", trim: true },
}, { _id: false });

const intelligenceInsightSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
  signalKey: { type: String, required: true, trim: true },
  category: { type: String, enum: ["SALES", "ORDERS", "MENU", "CUSTOMER", "INVENTORY", "KITCHEN", "STAFF", "PAYMENTS", "RECONCILIATION", "DATA_QUALITY"], required: true, index: true },
  severity: { type: String, enum: ["INFO", "OPPORTUNITY", "ATTENTION", "CRITICAL"], required: true, index: true },
  status: { type: String, enum: ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"], default: "ACTIVE", index: true },
  title: { type: String, required: true, trim: true, maxlength: 220 },
  summary: { type: String, required: true, trim: true, maxlength: 1000 },
  evidence: { type: [evidenceSchema], default: [] },
  recommendedActions: { type: [String], default: [] },
  confidence: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], default: "LOW" },
  dataPeriod: { range: { type: String, required: true }, start: { type: Date, required: true }, end: { type: Date, required: true } },
  generatedAt: { type: Date, default: Date.now },
  acknowledgedAt: { type: Date, default: null },
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

intelligenceInsightSchema.index({ restaurant: 1, signalKey: 1, "dataPeriod.start": 1, "dataPeriod.end": 1 }, { unique: true, name: "intelligence_signal_period_unique" });
intelligenceInsightSchema.index({ restaurant: 1, status: 1, severity: 1, generatedAt: -1 });

export default mongoose.model("IntelligenceInsight", intelligenceInsightSchema);
