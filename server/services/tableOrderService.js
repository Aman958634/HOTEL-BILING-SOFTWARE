import ApiError from "../utils/ApiError.js";
import Order from "../models/Order.js";
import Table from "../models/Table.js";
import {
  TABLE_STATUS,
  activeOrderStatuses,
  emitTableStatusChange,
  releaseOrderFromTable,
} from "./tableStateService.js";

const tableLabel = (table) => (table?.tableNumber ? `Table ${table.tableNumber}` : "Selected table");

const resolveId = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value._id || value.id || null;
  return value;
};

const assertTableTenant = (table, restaurantId) => {
  if (!restaurantId || !table?.restaurant) return;
  if (String(table.restaurant) !== String(restaurantId)) {
    throw new ApiError(403, "Table does not belong to your restaurant");
  }
};

const buildActiveOrderFilter = (tableId, { excludeOrderId = null } = {}) => {
  const query = {
    table: tableId,
    isArchived: { $ne: true },
    status: { $in: activeOrderStatuses },
  };
  if (excludeOrderId) query._id = { $ne: excludeOrderId };
  return query;
};

export const findActiveOrdersForTable = async (tableId, { excludeOrderId = null } = {}) =>
  Order.find(buildActiveOrderFilter(tableId, { excludeOrderId }))
    .select("_id orderNumber status paymentStatus total")
    .sort({ createdAt: -1 })
    .lean();

export const findActiveOrderForTable = async (tableId, { excludeOrderId = null } = {}) => {
  const orders = await findActiveOrdersForTable(tableId, { excludeOrderId });
  return orders[0] || null;
};

export const countActiveOrdersForTable = async (tableId, { excludeOrderId = null } = {}) =>
  Order.countDocuments(buildActiveOrderFilter(tableId, { excludeOrderId }));

/**
 * Derive the table's status purely from real database state:
 *   - MAINTENANCE is a manual override and is preserved.
 *   - OCCUPIED  = at least one ACTIVE order exists.
 *   - RESERVED  = no active order but an active reservation exists.
 *   - AVAILABLE = no active order and no active reservation.
 *
 * `currentOrder` is denormalised to the most recent active order (or null).
 * This supports MULTIPLE active DINE_IN orders per table: completing or
 * cancelling one order only frees the table when no other active order remains.
 */
export const recalculateTableStatus = async (tableId) => {
  const id = resolveId(tableId);
  if (!id) return null;

  const table = await Table.findById(id);
  if (!table) return null;

  if (String(table.status).toUpperCase() === TABLE_STATUS.MAINTENANCE) {
    return table;
  }

  const activeOrders = await findActiveOrdersForTable(table._id);
  const activeCount = activeOrders.length;
  const latestActive = activeOrders[0];

  if (activeCount > 0) {
    table.status = TABLE_STATUS.OCCUPIED;
    table.currentOrder = latestActive?._id || null;
  } else {
    table.currentOrder = null;
    table.status = table.currentReservation
      ? TABLE_STATUS.RESERVED
      : TABLE_STATUS.AVAILABLE;
  }

  await table.save();
  emitTableStatusChange(table);
  return table;
};

export const reconcileTableAvailability = recalculateTableStatus;

export const reconcileTablesAvailability = async (tables = []) => {
  const results = [];
  for (const table of tables) {
    const healed = await recalculateTableStatus(table._id || table);
    results.push(healed || table);
  }
  return results;
};

/**
 * Mark a table as OCCUPIED for a DINE_IN order.
 *
 * A table may host MULTIPLE active DINE_IN orders, so an existing active order
 * no longer blocks a new one. Only MAINTENANCE tables cannot be seated.
 */
export const assignTableForDineInOrder = async (tableId, orderId, { restaurantId } = {}) => {
  if (!tableId) {
    throw new ApiError(422, "Table is required for DINE_IN orders.");
  }
  if (!orderId) {
    throw new ApiError(422, "Order id is required to occupy a table.");
  }

  const table = await Table.findById(tableId);
  if (!table) throw new ApiError(404, "Table not found");

  assertTableTenant(table, restaurantId);

  if (String(table.status).toUpperCase() === TABLE_STATUS.MAINTENANCE) {
    throw new ApiError(409, `${tableLabel(table)} is under maintenance.`);
  }

  // The new order is active, so the table is occupied. Recalculation keeps it
  // OCCUPIED whether or not other active orders already exist.
  table.status = TABLE_STATUS.OCCUPIED;
  table.currentOrder = orderId;

  await table.save();
  emitTableStatusChange(table);

  return table;
};

export const releaseOrderTableIfNeeded = async (order) => {
  const tableId = resolveId(order?.table);
  if (!tableId) return null;

  const orderId = resolveId(order?._id || order?.id);
  return releaseOrderFromTable(tableId, orderId);
};

/**
 * Recompute the table status after an order is settled.
 *
 * An order is removed from the "active" set once it is CANCELLED or COMPLETED,
 * so releasing simply recalculates from the remaining active orders:
 *   - other active orders remain  -> OCCUPIED
 *   - no active orders remain      -> AVAILABLE (or RESERVED if reserved)
 */
export const maybeReleaseTableAfterSettlement = async (order) => {
  const tableId = resolveId(order?.table);
  if (!tableId) return null;

  const status = String(order.status || "").toUpperCase();
  if (status === "CANCELLED" || status === "COMPLETED") {
    return recalculateTableStatus(tableId);
  }

  return null;
};
