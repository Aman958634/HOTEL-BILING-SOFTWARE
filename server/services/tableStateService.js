import mongoose from "mongoose";
import Table from "../models/Table.js";
import Order from "../models/Order.js";
import ApiError from "../utils/ApiError.js";
import { getIO } from "../config/socket.js";

export const TABLE_STATUS = {
  AVAILABLE: "AVAILABLE",
  OCCUPIED: "OCCUPIED",
  RESERVED: "RESERVED",
  MAINTENANCE: "MAINTENANCE",
};

const statusAliases = {
  available: TABLE_STATUS.AVAILABLE,
  occupied: TABLE_STATUS.OCCUPIED,
  reserved: TABLE_STATUS.RESERVED,
  maintenance: TABLE_STATUS.MAINTENANCE,
};

const toObjectId = (value, fieldName) => {
  const id = typeof value === "object" && value ? value._id || value.id : value;
  if (!id) return null;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid ${fieldName}`);
  return id;
};

export const normalizeTableStatus = (value) => {
  if (!value) return TABLE_STATUS.AVAILABLE;
  const normalized = String(value).trim();
  if (TABLE_STATUS[normalized]) return normalized;
  const alias = statusAliases[normalized.toLowerCase()];
  if (alias) return alias;
  throw new ApiError(422, "Invalid table status");
};

// The sole definition of an active order for table occupancy.
// A ready/served dine-in order still represents an occupied table. A served
// order becomes releasable only after its bill has been settled.
export const activeOrderStatuses = ["PENDING", "CONFIRMED", "PREPARING", "READY", "SERVED"];
export const activeReservationStatuses = ["pending", "confirmed", "PENDING", "CONFIRMED"];

export const emitTableStatusChange = (table) => {
  try {
    getIO().to("dashboard").emit("table:statusChanged", {
      tableId: table._id,
      tableNumber: table.tableNumber,
      status: table.status,
      currentOrder: table.currentOrder || null,
      ...(table.activeOrderCount != null ? { activeOrderCount: table.activeOrderCount } : {}),
    });
  } catch (_error) {
    // Socket delivery must not affect lifecycle consistency.
  }
};

/**
 * The single table-status lifecycle writer. Never accept a requested status:
 * table occupancy is derived exclusively from the current order records.
 */
export const updateTableStatus = async (tableId) => {
  const id = toObjectId(tableId, "table id");
  if (!id) throw new ApiError(400, "Table id is required");

  const activeFilter = { table: id, $or: [
    { status: { $in: ["PENDING", "CONFIRMED", "PREPARING", "READY"] } },
    { status: "SERVED", billingState: { $ne: "SETTLED" } },
  ] };
  const activeOrders = await Order.countDocuments(activeFilter);
  const currentOrder = activeOrders > 0
    ? await Order.findOne(activeFilter)
        .sort({ createdAt: -1 })
        .select("_id")
        .lean()
    : null;

  const table = await Table.findByIdAndUpdate(
    id,
    {
      status: activeOrders > 0 ? TABLE_STATUS.OCCUPIED : TABLE_STATUS.AVAILABLE,
      currentOrder: currentOrder?._id || null,
    },
    { new: true, runValidators: true }
  );
  if (!table) throw new ApiError(404, "Table not found");

  table.activeOrderCount = activeOrders;
  emitTableStatusChange(table);
  return table;
};

// Compatibility alias for callers that previously used the old lifecycle API.
export const updateTableLifecycleState = updateTableStatus;

export const assignOrderToTable = (tableId) => updateTableStatus(tableId);
export const releaseOrderFromTable = (tableId) => updateTableStatus(tableId);

export const assignReservationToTable = async (tableId, reservationId) => {
  const id = toObjectId(tableId, "table id");
  const reservation = toObjectId(reservationId, "reservation id");
  if (!id || !reservation) throw new ApiError(400, "Table id and reservation id are required");
  const table = await Table.findByIdAndUpdate(id, { currentReservation: reservation }, { new: true });
  if (!table) throw new ApiError(404, "Table not found");
  return updateTableStatus(id);
};

export const releaseReservationFromTable = async (tableId, reservationId = null) => {
  const id = toObjectId(tableId, "table id");
  if (!id) return null;
  const table = await Table.findById(id);
  if (!table) return null;
  if (reservationId && String(table.currentReservation || "") !== String(reservationId)) return table;
  await Table.updateOne({ _id: id }, { $set: { currentReservation: null } });
  return updateTableStatus(id);
};
