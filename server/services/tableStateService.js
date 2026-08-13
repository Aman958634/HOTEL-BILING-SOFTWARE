import mongoose from "mongoose";
import Table from "../models/Table.js";
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
  if (!value) return null;
  if (!mongoose.isValidObjectId(value)) {
    throw new ApiError(400, `Invalid ${fieldName}`);
  }
  return value;
};

export const normalizeTableStatus = (value) => {
  if (!value) return TABLE_STATUS.AVAILABLE;

  const normalized = String(value).trim();
  if (TABLE_STATUS[normalized]) return normalized;

  const alias = statusAliases[normalized.toLowerCase()];
  if (alias) return alias;

  throw new ApiError(422, "Invalid table status");
};

export const activeOrderStatuses = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "SERVED",
  "placed",
  "accepted",
  "preparing",
  "ready",
  "served",
  "out_for_delivery",
];

export const activeReservationStatuses = ["pending", "confirmed", "PENDING", "CONFIRMED"];

export const emitTableStatusChange = (table) => {
  try {
    const io = getIO();
    io.to("dashboard").emit("table:statusChanged", {
      tableId: table._id,
      tableNumber: table.tableNumber,
      status: table.status,
      currentOrder: table.currentOrder || null,
    });
  } catch (_error) {
    // Socket server may be unavailable in non-server runtime contexts.
  }
};

export const updateTableLifecycleState = async (tableId, payload = {}) => {
  const id = toObjectId(tableId, "table id");
  if (!id) throw new ApiError(400, "Table id is required");

  const table = await Table.findById(id);
  if (!table) throw new ApiError(404, "Table not found");

  if (payload.status !== undefined) {
    table.status = normalizeTableStatus(payload.status);
  }

  if (payload.currentOrder !== undefined) {
    table.currentOrder = toObjectId(payload.currentOrder, "order id");
  }

  if (payload.currentReservation !== undefined) {
    table.currentReservation = toObjectId(payload.currentReservation, "reservation id");
  }

  await table.save();
  emitTableStatusChange(table);

  return table;
};

export const assignOrderToTable = async (tableId, orderId) =>
  updateTableLifecycleState(tableId, {
    status: TABLE_STATUS.OCCUPIED,
    currentOrder: orderId,
  });

export const releaseOrderFromTable = async (tableId, orderId = null) => {
  const id = toObjectId(
    typeof tableId === "object" && tableId ? tableId._id || tableId.id || tableId : tableId,
    "table id"
  );
  if (!id) return null;

  const table = await Table.findById(id);
  if (!table) return null;

  const normalizedOrderId = orderId
    ? String(typeof orderId === "object" ? orderId._id || orderId.id || orderId : orderId)
    : null;

  // Only skip release when another order currently owns the table
  if (
    normalizedOrderId &&
    table.currentOrder &&
    String(table.currentOrder) !== normalizedOrderId
  ) {
    // If the pointer order is no longer active, still allow cleanup by caller reconcile
    return table;
  }

  table.currentOrder = null;
  if (!table.currentReservation) {
    table.status = TABLE_STATUS.AVAILABLE;
  } else {
    table.status = TABLE_STATUS.RESERVED;
  }

  await table.save();
  emitTableStatusChange(table);

  return table;
};

export const assignReservationToTable = async (tableId, reservationId) =>
  updateTableLifecycleState(tableId, {
    status: TABLE_STATUS.RESERVED,
    currentReservation: reservationId,
  });

export const releaseReservationFromTable = async (tableId, reservationId = null) => {
  const id = toObjectId(tableId, "table id");
  if (!id) return null;

  const table = await Table.findById(id);
  if (!table) return null;

  if (reservationId && table.currentReservation && String(table.currentReservation) !== String(reservationId)) {
    return table;
  }

  table.currentReservation = null;
  if (!table.currentOrder) {
    table.status = TABLE_STATUS.AVAILABLE;
  } else {
    table.status = TABLE_STATUS.OCCUPIED;
  }

  await table.save();
  emitTableStatusChange(table);

  return table;
};
