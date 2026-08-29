import mongoose from "mongoose";

const TABLE_SHAPES = ["ROUND", "SQUARE", "RECTANGLE"];
const TABLE_STATUSES = ["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"];

const normalizeEnum = (value, fallback) => {
  if (!value) return fallback;
  return String(value).trim().toUpperCase();
};

const tableSchema = new mongoose.Schema(
  {
    tableNumber: {
      type: String,
      required: true,
      trim: true,
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: false,
      index: true,
      default: null,
    },
    capacity: { type: Number, required: true, min: 1 },
    floor: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    shape: {
      type: String,
      enum: TABLE_SHAPES,
      default: "SQUARE",
      set: (value) => normalizeEnum(value, "SQUARE"),
    },
    status: {
      type: String,
      enum: TABLE_STATUSES,
      default: "AVAILABLE",
      set: (value) => normalizeEnum(value, "AVAILABLE"),
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    currentOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    currentReservation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reservation",
      default: null,
    },
    outlet: { type: mongoose.Schema.Types.ObjectId, ref: "Outlet", default: null, index: true },
    assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", default: null, index: true },
  },
  { timestamps: true }
);

tableSchema.pre("validate", function normalizeLegacyValues(next) {
  if (this.status) {
    this.status = normalizeEnum(this.status, "AVAILABLE");
  }

  if (this.shape) {
    this.shape = normalizeEnum(this.shape, "SQUARE");
  }

  if (this.tableNumber) {
    this.tableNumber = String(this.tableNumber).trim();
  }

  next();
});

tableSchema.index({ restaurant: 1, outlet: 1, tableNumber: 1 }, { unique: true, partialFilterExpression: { restaurant: { $type: "objectId" }, outlet: { $type: "objectId" } } });
tableSchema.index({ status: 1 });
tableSchema.index({ floor: 1 });
tableSchema.index({ section: 1 });

const Table = mongoose.model("Table", tableSchema);
export default Table;
