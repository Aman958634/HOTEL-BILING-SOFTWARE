import ApiError from "../utils/ApiError.js";
import Order from "../models/Order.js";
import Table from "../models/Table.js";
import {
  TABLE_STATUS,
  activeOrderStatuses,
  emitTableStatusChange,
  releaseOrderFromTable,
} from "./tableStateService.js";
import { deriveTableLifecycle } from "./lifecycleService.js";
import { ACTIVE_ORDER_QUERY, isActiveOrder } from "./posValidationService.js";
import { transitionTable } from "./posIntegrityService.js";

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
    ...ACTIVE_ORDER_QUERY,
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

  const [orders, activeOrders] = await Promise.all([
    Order.find({ table: table._id, isArchived: { $ne: true } })
      .select("_id status paymentStatus billingStatus createdAt")
      .sort({ createdAt: -1 })
      .lean(),
    findActiveOrdersForTable(table._id),
  ]);
  const activeCount = activeOrders.length;
  const latestActive = activeOrders[0];

  table.status = deriveTableLifecycle({ table, orders });
  table.currentOrder = latestActive?._id || null;

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
      $match: { table: { $in: ids }, ...ACTIVE_ORDER_QUERY },
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
      const previousCurrentOrder = table.currentOrder || null;
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
      const orderChanged = String(previousCurrentOrder || "") !== String(nextCurrentOrder || "");

      if (statusChanged || orderChanged) {
        bulk.push({
          updateOne: {
            filter: { _id: table._id },
          update: { $set: { status: nextStatus, currentOrder: nextCurrentOrder, activeOrderCount: activeCount } },
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
export const assignTableForDineInOrder = async (tableId, orderId, { restaurantId, actor = null, session = null } = {}) => {
  if (!tableId) {
    throw new ApiError(422, "Table is required for DINE_IN orders.");
  }
  if (!orderId) {
    throw new ApiError(422, "Order id is required to occupy a table.");
  }

  // Load once for tenant validation, then perform an atomic status write that
  // refuses to seat a table that is (or becomes) under MAINTENANCE. Multiple
  // active DINE_IN orders are allowed, so no single-order 409 is raised.
  let tableQuery = Table.findById(tableId);
  if (session) tableQuery = tableQuery.session(session);
  const table = await tableQuery;
  if (!table) throw new ApiError(404, "Table not found");

  assertTableTenant(table, restaurantId);
  if (String(table.status).toUpperCase() === TABLE_STATUS.MAINTENANCE) {
    throw new ApiError(409, `${tableLabel(table)} is under maintenance.`);
  }

  // The command, not a table read, owns the state transition.  Persist each
  // lifecycle edge to make the progression auditable.
  if ([TABLE_STATUS.AVAILABLE, TABLE_STATUS.RESERVED].includes(String(table.status).toUpperCase())) {
    table.currentOrder = orderId;
    await transitionTable({ table, toStatus: TABLE_STATUS.ORDER_CREATED, order: orderId, actor, reason: "order-created", session });
    await transitionTable({ table, toStatus: TABLE_STATUS.OCCUPIED, order: orderId, actor, reason: "order-confirmed", session });
  } else {
    table.currentOrder = orderId;
    await table.save(session ? { session } : undefined);
  }
  if (!session) emitTableStatusChange(table);
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
  const paymentStatus = String(order.paymentStatus || "").toUpperCase();

  if (status === "CANCELLED") {
    return recalculateTableStatus(tableId);
  }

  // Keep table occupied until order is completed AND paid.
  if (status === "COMPLETED" && paymentStatus === "PAID") {
    const remainingOrders = await findActiveOrdersForTable(tableId);
    if (remainingOrders.length === 0) {
      const table = await Table.findById(tableId);
      if (table && String(table.status).toUpperCase() !== TABLE_STATUS.MAINTENANCE) {
        table.currentOrder = null;
        table.activeOrderCount = 0;
        await transitionTable({ table, toStatus: TABLE_STATUS.BILL, order, reason: "bill-settlement" });
        await transitionTable({ table, toStatus: TABLE_STATUS.PAYMENT_VERIFIED, order, reason: "payment-verified" });
        await transitionTable({ table, toStatus: TABLE_STATUS.PAID, order, reason: "payment-settled" });
        await transitionTable({ table, toStatus: TABLE_STATUS.AVAILABLE, order, reason: "table-released" });
        emitTableStatusChange(table);
      }
    }
    return recalculateTableStatus(tableId);
  }

  if (paymentStatus === "PAID") {
    return recalculateTableStatus(tableId);
  }

  return null;
};
