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
  const id = typeof value === "object" && value && !mongoose.isValidObjectId(value)
    ? value._id || value.id
    : value;
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

// The sole definition of operational work that keeps a dine-in table occupied.
// Financial state intentionally does not appear here: serving an order ends its
// table occupancy even if settlement happens afterwards.
export const TABLE_ACTIVE_ORDER_STATUSES = Object.freeze(["PENDING", "CONFIRMED", "PREPARING", "READY"]);
export const TABLE_TERMINAL_ORDER_STATUSES = Object.freeze(["SERVED", "COMPLETED", "CANCELLED", "REJECTED"]);
// Kept for consumers that only need the active labels. Queries must use
// buildActiveTableOrderQuery so scope and archival checks cannot drift.
export const activeOrderStatuses = TABLE_ACTIVE_ORDER_STATUSES;
export const activeReservationStatuses = ["pending", "confirmed", "PENDING", "CONFIRMED"];

export const isOrderActiveForTable = (order) => Boolean(order)
  && order.isArchived !== true
  && TABLE_ACTIVE_ORDER_STATUSES.includes(String(order.status || "").toUpperCase());

export const buildActiveTableOrderQuery = ({ restaurantId, outletId, tableId, excludeOrderId = null } = {}) => {
  const table = toObjectId(tableId, "table id");
  if (!table) throw new ApiError(400, "Table id is required");
  const restaurant = toObjectId(restaurantId, "restaurant id");
  const outlet = toObjectId(outletId, "outlet id");
  const query = {
    table,
    restaurant: restaurant || null,
    outlet: outlet || null,
    orderType: "DINE_IN",
    isArchived: { $ne: true },
    status: { $in: TABLE_ACTIVE_ORDER_STATUSES },
  };
  if (excludeOrderId) query._id = { $ne: excludeOrderId };
  return query;
};

export const getTableSocketRoom = (table) => {
  const outletId = table?.outlet?._id || table?.outlet || null;
  return outletId ? `outlet:${outletId}` : null;
};

export const emitTableStatusChange = (table) => {
  try {
    const room = getTableSocketRoom(table);
    // A table is operationally outlet-scoped. Do not broadcast a legacy
    // unscoped record to the whole restaurant; polling remains authoritative.
    if (!room) return;
    getIO().to(room).emit("table:statusChanged", {
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
export const reconcileTableOccupancy = async (tableId, { session = null } = {}) => {
  const id = toObjectId(tableId, "table id");
  if (!id) throw new ApiError(400, "Table id is required");

  const tableScope = await Table.findById(id)
    .select("_id restaurant outlet status currentOrder")
    .session(session)
    .lean();
  if (!tableScope) throw new ApiError(404, "Table not found");

  const activeFilter = buildActiveTableOrderQuery({
    restaurantId: tableScope.restaurant,
    outletId: tableScope.outlet,
    tableId: tableScope._id,
  });
  const [activeOrders, currentOrder] = await Promise.all([
    Order.countDocuments(activeFilter).session(session),
    Order.findOne(activeFilter).sort({ createdAt: -1 }).select("_id").session(session).lean(),
  ]);

  // Reservation and maintenance are explicit operational controls. Deriving
  // order occupancy must not silently erase either state.
  const derivedStatus = [TABLE_STATUS.RESERVED, TABLE_STATUS.MAINTENANCE].includes(tableScope.status)
    ? tableScope.status
    : activeOrders > 0 ? TABLE_STATUS.OCCUPIED : TABLE_STATUS.AVAILABLE;
  const table = await Table.findByIdAndUpdate(id, {
    $set: { status: derivedStatus, currentOrder: currentOrder?._id || null },
  }, { new: true, runValidators: true, session });

  table.activeOrderCount = activeOrders;
  if (tableScope.status !== table.status || String(tableScope.currentOrder || "") !== String(table.currentOrder || "")) {
    emitTableStatusChange(table);
  }
  return table;
};

export const updateTableStatus = reconcileTableOccupancy;

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
