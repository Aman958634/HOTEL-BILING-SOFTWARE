import ApiError from "../utils/ApiError.js";
import Order from "../models/Order.js";
import Table from "../models/Table.js";
import { buildActiveTableOrderQuery, updateTableStatus } from "./tableStateService.js";

const resolveId = (value) => (typeof value === "object" && value ? value._id || value.id : value) || null;

const activeOrderFilter = async (tableId, options = {}) => {
  const table = await Table.findById(tableId).select("_id restaurant outlet").lean();
  if (!table) throw new ApiError(404, "Table not found");
  return buildActiveTableOrderQuery({
    restaurantId: table.restaurant,
    outletId: table.outlet,
    tableId: table._id,
    ...options,
  });
};

export const findActiveOrdersForTable = async (tableId, options = {}) => {
  const filter = await activeOrderFilter(tableId, options);
  return Order.find(filter)
    .select("_id orderNumber status paymentStatus total customer createdAt")
    .populate("customer", "fullName email phone")
    .sort({ createdAt: -1 })
    .lean();
};

export const findActiveOrderForTable = async (tableId, options = {}) =>
  (await findActiveOrdersForTable(tableId, options))[0] || null;

export const countActiveOrdersForTable = async (tableId, options = {}) =>
  Order.countDocuments(await activeOrderFilter(tableId, options));

export const recalculateTableStatus = updateTableStatus;
export const reconcileTableAvailability = updateTableStatus;

export const reconcileTablesAvailability = async (tables = []) => {
  const list = Array.isArray(tables) ? tables : [];
  return Promise.all(list.map((table) => updateTableStatus(table._id)));
};

export const assignTableForDineInOrder = async (tableId, _orderId, { restaurantId, alreadyValidated = false } = {}) => {
  if (!tableId) throw new ApiError(422, "Table is required for DINE_IN orders.");
  if (!alreadyValidated) {
    const table = await Table.findById(tableId).select("restaurant");
    if (!table) throw new ApiError(404, "Table not found");
    if (restaurantId && table.restaurant && String(table.restaurant) !== String(restaurantId)) {
      throw new ApiError(403, "Table does not belong to your restaurant");
    }
  }
  return updateTableStatus(tableId);
};

export const releaseOrderTableIfNeeded = (order) => {
  const tableId = resolveId(order?.table);
  return tableId ? updateTableStatus(tableId) : null;
};

// Every terminal order/payment event re-derives from all orders on the table.
export const maybeReleaseTableAfterSettlement = releaseOrderTableIfNeeded;
