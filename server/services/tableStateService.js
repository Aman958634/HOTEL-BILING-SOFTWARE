import mongoose from "mongoose";
import Table from "../models/Table.js";
import Order from "../models/Order.js";
import ApiError from "../utils/ApiError.js";
import { getIO } from "../config/socket.js";
import { deriveTableLifecycle, TABLE_LIFECYCLE } from "./lifecycleService.js";

export const TABLE_STATUS = {
  ...TABLE_LIFECYCLE,
};

const statusAliases = {
  available: TABLE_STATUS.AVAILABLE,
  order_created: TABLE_STATUS.ORDER_CREATED,
  occupied: TABLE_STATUS.OCCUPIED,
  bill: TABLE_STATUS.BILL,
  payment_verified: TABLE_STATUS.PAYMENT_VERIFIED,
  paid: TABLE_STATUS.PAID,
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
    if (!table.restaurant) return;
    io.to(`restaurant:${table.restaurant}`).emit("table:statusChanged", {
      tableId: table._id,
      tableNumber: table.tableNumber,
      status: table.status,
      currentOrder: table.currentOrder || null,
      ...(table.activeOrderCount != null ? { activeOrderCount: table.activeOrderCount } : {}),
    });
  } catch (_error) {
    // Socket server may be unavailable in non-server runtime contexts.
  }
};

/**
 * Derive a table's status from real database state.
 *   - MAINTENANCE is a manual override and is preserved.
 *   - Lifecycle state is derived from persisted server-side order/billing data.
 *   - RESERVED  = no active order but an active reservation exists.
 *   - AVAILABLE = no active order and no active reservation.
 *
 * Supports MULTIPLE active orders per table: the table stays OCCUPIED until the
 * last active order is completed/cancelled.
 */
const recomputeTableState = async (table) => {
  if (String(table.status).toUpperCase() === TABLE_STATUS.MAINTENANCE) {
    await table.save();
    emitTableStatusChange(table);
    return table;
  }

  const orders = await Order.find({
    table: table._id,
    isArchived: { $ne: true },
  })
    .select("_id status paymentStatus billingStatus createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const activeOrders = orders.filter((order) => activeOrderStatuses.includes(String(order.status).toUpperCase()));
  table.status = deriveTableLifecycle({ table, orders });
  table.currentOrder = activeOrders[0]?._id || null;

  table.activeOrderCount = activeOrders.length;
  await table.save();
  emitTableStatusChange(table);
  return table;
};

export const updateTableLifecycleState = async (tableId, payload = {}) => {
  const id = toObjectId(tableId, "table id");
  if (!id) throw new ApiError(400, "Table id is required");

  const table = await Table.findById(id);
  if (!table) throw new ApiError(404, "Table not found");

  if (payload.currentOrder !== undefined) {
    table.currentOrder = toObjectId(payload.currentOrder, "order id");
  }

  if (payload.currentReservation !== undefined) {
    table.currentReservation = toObjectId(payload.currentReservation, "reservation id");
  }

  const requested = payload.status !== undefined ? normalizeTableStatus(payload.status) : null;

  if (requested === TABLE_STATUS.MAINTENANCE) {
    table.status = TABLE_STATUS.MAINTENANCE;
    table.currentOrder = null;
    await table.save();
    emitTableStatusChange(table);
    return table;
  }

  // AVAILABLE / OCCUPIED / RESERVED are derived from active orders & reservations.
  await recomputeTableState(table);
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

  // The table state is derived from all active orders, not from a single pointer,
  // so releasing one order never frees the table while other active orders remain.
  await recomputeTableState(table);
  return table;
};

export const assignReservationToTable = async (tableId, reservationId) => {
  const id = toObjectId(tableId, "table id");
  if (!id) throw new ApiError(400, "Table id is required");

  const table = await Table.findById(id);
  if (!table) throw new ApiError(404, "Table not found");

  table.currentReservation = toObjectId(reservationId, "reservation id");
  await recomputeTableState(table);
  return table;
};

export const releaseReservationFromTable = async (tableId, reservationId = null) => {
  const id = toObjectId(tableId, "table id");
  if (!id) return null;

  const table = await Table.findById(id);
  if (!table) return null;

  if (reservationId && table.currentReservation && String(table.currentReservation) !== String(reservationId)) {
    return table;
  }

  table.currentReservation = null;
  await recomputeTableState(table);
  return table;
};
