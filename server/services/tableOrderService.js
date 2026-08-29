import ApiError from "../utils/ApiError.js";
import Order from "../models/Order.js";
import Table from "../models/Table.js";
import { activeOrderStatuses, updateTableStatus } from "./tableStateService.js";

const resolveId = (value) => (typeof value === "object" && value ? value._id || value.id : value) || null;

const activeOrderFilter = (tableId, { excludeOrderId = null } = {}) => {
  const filter = { table: tableId, $or: [
    { status: { $in: ["PENDING", "CONFIRMED", "PREPARING", "READY"] } },
    { status: "SERVED", billingState: { $ne: "SETTLED" } },
  ] };
  if (excludeOrderId) filter._id = { $ne: excludeOrderId };
  return filter;
};

export const findActiveOrdersForTable = async (tableId, options = {}) =>
  Order.find(activeOrderFilter(tableId, options))
    .select("_id orderNumber status paymentStatus total")
    .sort({ createdAt: -1 })
    .lean();

export const findActiveOrderForTable = async (tableId, options = {}) =>
  (await findActiveOrdersForTable(tableId, options))[0] || null;

export const countActiveOrdersForTable = (tableId, options = {}) =>
  Order.countDocuments(activeOrderFilter(tableId, options));

export const recalculateTableStatus = updateTableStatus;
export const reconcileTableAvailability = updateTableStatus;

export const reconcileTablesAvailability = async (tables = []) => {
  const list = Array.isArray(tables) ? tables : [];
  return Promise.all(list.map((table) => updateTableStatus(table._id)));
};

export const assignTableForDineInOrder = async (tableId, _orderId, { restaurantId } = {}) => {
  if (!tableId) throw new ApiError(422, "Table is required for DINE_IN orders.");
  const table = await Table.findById(tableId);
  if (!table) throw new ApiError(404, "Table not found");
  if (restaurantId && table.restaurant && String(table.restaurant) !== String(restaurantId)) {
    throw new ApiError(403, "Table does not belong to your restaurant");
  }
  return updateTableStatus(table._id);
};

export const releaseOrderTableIfNeeded = (order) => {
  const tableId = resolveId(order?.table);
  return tableId ? updateTableStatus(tableId) : null;
};

// Every terminal order/payment event re-derives from all orders on the table.
export const maybeReleaseTableAfterSettlement = releaseOrderTableIfNeeded;
