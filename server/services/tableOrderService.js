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

const occupiedMessage = (table, { short = false } = {}) => {
  const label = tableLabel(table);
  if (short) return `${label} is currently occupied.`;
  return `${label} is currently occupied. Please complete the current order before creating a new order.`;
};

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

export const findActiveOrderForTable = async (tableId, { excludeOrderId = null } = {}) => {
  const query = {
    table: tableId,
    isArchived: { $ne: true },
    status: { $in: activeOrderStatuses },
  };
  if (excludeOrderId) query._id = { $ne: excludeOrderId };

  return Order.findOne(query).select("_id orderNumber status paymentStatus").sort({ createdAt: -1 }).lean();
};

/**
 * Heal stale OCCUPIED tables when no active dine-in order remains.
 * Never deletes orders — only clears occupancy pointers.
 */
export const reconcileTableAvailability = async (tableId) => {
  const id = resolveId(tableId);
  if (!id) return null;

  const table = await Table.findById(id);
  if (!table) return null;

  if (String(table.status).toUpperCase() === TABLE_STATUS.MAINTENANCE) {
    return table;
  }

  const activeOrder = await findActiveOrderForTable(table._id);

  if (activeOrder) {
    const needsUpdate =
      String(table.status).toUpperCase() !== TABLE_STATUS.OCCUPIED ||
      String(table.currentOrder || "") !== String(activeOrder._id);

    if (needsUpdate) {
      table.status = TABLE_STATUS.OCCUPIED;
      table.currentOrder = activeOrder._id;
      await table.save();
      emitTableStatusChange(table);
    }
    return table;
  }

  // No active order — clear stale occupancy (keep RESERVED if reservation exists)
  const wasOccupied =
    String(table.status).toUpperCase() === TABLE_STATUS.OCCUPIED || Boolean(table.currentOrder);

  if (!wasOccupied && !table.currentOrder) {
    return table;
  }

  table.currentOrder = null;
  if (table.currentReservation) {
    table.status = TABLE_STATUS.RESERVED;
  } else {
    table.status = TABLE_STATUS.AVAILABLE;
  }

  await table.save();
  emitTableStatusChange(table);
  return table;
};

export const reconcileTablesAvailability = async (tables = []) => {
  const results = [];
  for (const table of tables) {
    const healed = await reconcileTableAvailability(table._id || table);
    results.push(healed || table);
  }
  return results;
};

/**
 * Atomically occupy a table for a dine-in order.
 * Same order re-assignment is allowed (edit flow).
 * Blocks only when another ACTIVE order exists.
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

  // Heal stale OCCUPIED / currentOrder pointing at completed/paid orders
  await reconcileTableAvailability(table._id);
  const fresh = await Table.findById(table._id);
  if (!fresh) throw new ApiError(404, "Table not found");

  if (fresh.currentOrder && String(fresh.currentOrder) === String(orderId)) {
    if (String(fresh.status).toUpperCase() !== TABLE_STATUS.OCCUPIED) {
      fresh.status = TABLE_STATUS.OCCUPIED;
      await fresh.save();
      emitTableStatusChange(fresh);
    }
    return fresh;
  }

  const activeOrder = await findActiveOrderForTable(fresh._id, { excludeOrderId: orderId });
  if (activeOrder) {
    throw new ApiError(409, occupiedMessage(fresh));
  }

  if (String(fresh.status).toUpperCase() === TABLE_STATUS.MAINTENANCE) {
    throw new ApiError(409, `${tableLabel(fresh)} is under maintenance.`);
  }

  // Atomic claim — only if still free after reconcile
  const claimed = await Table.findOneAndUpdate(
    {
      _id: fresh._id,
      status: { $in: [TABLE_STATUS.AVAILABLE, TABLE_STATUS.RESERVED] },
      $or: [{ currentOrder: null }, { currentOrder: { $exists: false } }],
    },
    {
      $set: {
        status: TABLE_STATUS.OCCUPIED,
        currentOrder: orderId,
      },
    },
    { new: true }
  );

  if (!claimed) {
    // Race: another cashier occupied it first
    const latest = await Table.findById(fresh._id);
    throw new ApiError(409, occupiedMessage(latest || fresh, { short: true }));
  }

  emitTableStatusChange(claimed);
  return claimed;
};

export const releaseOrderTableIfNeeded = async (order) => {
  const tableId = resolveId(order?.table);
  if (!tableId) return null;

  const orderId = resolveId(order?._id || order?.id);
  return releaseOrderFromTable(tableId, orderId);
};

/**
 * Release only when cancelled, or when COMPLETED + PAID.
 * Never deletes orders — only clears table occupancy.
 */
export const maybeReleaseTableAfterSettlement = async (order) => {
  const tableId = resolveId(order?.table);
  if (!tableId) return null;

  const orderId = resolveId(order?._id || order?.id);
  const status = String(order.status || "").toUpperCase();
  const paymentStatus = String(order.paymentStatus || "").toUpperCase();

  if (status === "CANCELLED") {
    const released = await releaseOrderTableIfNeeded(order);
    // Also heal in case currentOrder pointed elsewhere but no active order remains
    await reconcileTableAvailability(tableId);
    return released;
  }

  if (status === "COMPLETED" && paymentStatus === "PAID") {
    await releaseOrderFromTable(tableId, orderId);
    // Force AVAILABLE if no other active order remains (heals stale pointers)
    return reconcileTableAvailability(tableId);
  }

  return null;
};
