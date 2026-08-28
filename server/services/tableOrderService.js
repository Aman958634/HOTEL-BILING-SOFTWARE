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
    status: { $nin: ["CANCELLED", "cancelled", "Cancelled"] },
    $or: [
      { status: { $in: activeOrderStatuses } },
      {
        status: { $in: ["COMPLETED", "completed"] },
        paymentStatus: { $nin: ["PAID", "paid"] },
      },
    ],
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

  table.activeOrderCount = activeCount;
  await table.save();
  emitTableStatusChange(table);
  return table;
};

export const reconcileTableAvailability = recalculateTableStatus;

/**
 * Bulk-heal a set of tables in a single aggregation + a single bulkWrite.
 * Avoids the previous N+1 query pattern (one recalc per table) and isolates
 * per-table failures so a single bad table cannot break the whole listing.
 * Returns the same in-memory table docs with status/currentOrder refreshed.
 */
export const reconcileTablesAvailability = async (tables = []) => {
  const list = Array.isArray(tables) ? tables : [];
  if (!list.length) return list;

  const ids = list.map((t) => t._id).filter(Boolean);
  if (!ids.length) return list;

  const counts = await Order.aggregate([
    {
      $match: {
        table: { $in: ids },
        isArchived: { $ne: true },
        status: { $nin: ["CANCELLED", "cancelled", "Cancelled"] },
        $or: [
          { status: { $in: activeOrderStatuses } },
          {
            status: { $in: ["COMPLETED", "completed"] },
            paymentStatus: { $nin: ["PAID", "paid"] },
          },
        ],
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$table",
        count: { $sum: 1 },
        latest: { $first: "$_id" },
      },
    },
  ]);

  const countMap = new Map(counts.map((row) => [String(row._id), row]));

  const bulk = [];
  const emits = [];

  for (const table of list) {
    try {
      const currentStatus = String(table.status || "").toUpperCase();
      if (currentStatus === TABLE_STATUS.MAINTENANCE) continue;

      const info = countMap.get(String(table._id));
      const activeCount = info?.count || 0;
      const nextStatus = activeCount > 0
        ? TABLE_STATUS.OCCUPIED
        : table.currentReservation
        ? TABLE_STATUS.RESERVED
        : TABLE_STATUS.AVAILABLE;
      const nextCurrentOrder = activeCount > 0 ? info?.latest || null : null;

      table.status = nextStatus;
      table.currentOrder = nextCurrentOrder;
      table.activeOrderCount = activeCount;

      const statusChanged = currentStatus !== nextStatus;
      const orderChanged = String(table.currentOrder || "") !== String(nextCurrentOrder || "");

      if (statusChanged || orderChanged) {
        bulk.push({
          updateOne: {
            filter: { _id: table._id },
            update: { $set: { status: nextStatus, currentOrder: nextCurrentOrder } },
          },
        });
        emits.push({
          tableId: table._id,
          tableNumber: table.tableNumber,
          status: nextStatus,
          currentOrder: nextCurrentOrder,
          activeOrderCount: activeCount,
        });
      }
    } catch (_error) {
      // Isolate a single malformed table; keep the rest consistent.
      continue;
    }
  }

  if (bulk.length) {
    try {
      await Table.bulkWrite(bulk, { ordered: false });
      emits.forEach((payload) => emitTableStatusChange(payload));
    } catch (_error) {
      // Persisting is best-effort; in-memory docs already reflect derived state.
    }
  }

  return list;
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

  // Load once for tenant validation, then perform an atomic status write that
  // refuses to seat a table that is (or becomes) under MAINTENANCE. Multiple
  // active DINE_IN orders are allowed, so no single-order 409 is raised.
  const table = await Table.findById(tableId);
  if (!table) throw new ApiError(404, "Table not found");

  assertTableTenant(table, restaurantId);

  const updated = await Table.findOneAndUpdate(
    { _id: table._id, status: { $ne: TABLE_STATUS.MAINTENANCE } },
    { $set: { status: TABLE_STATUS.OCCUPIED, currentOrder: orderId } },
    { new: true }
  );

  if (!updated) {
    const exists = await Table.findById(table._id);
    if (!exists) throw new ApiError(404, "Table not found");
    throw new ApiError(409, `${tableLabel(exists)} is under maintenance.`);
  }

  emitTableStatusChange(updated);
  return updated;
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
  const paymentStatus = String(order.paymentStatus || "").toUpperCase();

  if (status === "CANCELLED") {
    return recalculateTableStatus(tableId);
  }

  // Keep table occupied until order is completed AND paid.
  if (status === "COMPLETED" && paymentStatus === "PAID") {
    return recalculateTableStatus(tableId);
  }

  if (paymentStatus === "PAID") {
    return recalculateTableStatus(tableId);
  }

  return null;
};
