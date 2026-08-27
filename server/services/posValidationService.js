import ApiError from "../utils/ApiError.js";
import { TABLE_LIFECYCLE, deriveTableLifecycle } from "./lifecycleService.js";

export const ACTIVE_ORDER_QUERY = Object.freeze({
  isArchived: { $ne: true },
  status: { $nin: ["CANCELLED", "VOIDED"] },
  $or: [
    { status: { $in: ["PENDING", "CONFIRMED", "PREPARING", "READY", "SERVED"] } },
    { status: "COMPLETED", paymentStatus: { $nin: ["PAID", "CANCELLED", "VOIDED"] } },
  ],
});

export const isActiveOrder = (order = {}) => {
  const status = String(order.status || "").toUpperCase();
  const paymentStatus = String(order.paymentStatus || "").toUpperCase();
  return !order.isArchived && status !== "CANCELLED" && status !== "VOIDED" && (
    ["PENDING", "CONFIRMED", "PREPARING", "READY", "SERVED"].includes(status) ||
    (status === "COMPLETED" && paymentStatus !== "PAID")
  );
};

export const assertOrderTableConsistency = ({ orderType, table, restaurant, tableRestaurant }) => {
  const type = String(orderType || "").toUpperCase();
  if (type === "DINE_IN" && !table) throw new ApiError(422, "Table is required for DINE_IN orders");
  if (type !== "DINE_IN" && table) throw new ApiError(422, "Only DINE_IN orders may have a table");
  if (tableRestaurant && restaurant && String(tableRestaurant) !== String(restaurant)) {
    throw new ApiError(403, "Table does not belong to the order restaurant");
  }
};

export const assertBillableOrder = (order) => {
  if (!order || order.isArchived || ["CANCELLED", "VOIDED"].includes(String(order.status).toUpperCase())) {
    throw new ApiError(409, "A cancelled or voided order cannot be billed");
  }
  if (String(order.paymentStatus).toUpperCase() === "PAID") throw new ApiError(409, "A paid order cannot be billed again");
};

export const assertCashSettlementAuthority = (user) => {
  if (!user || !["admin", "manager", "cashier"].includes(String(user.role || "").toLowerCase())) {
    throw new ApiError(403, "Only an authorized cashier, manager, or admin can settle cash");
  }
};

export const inspectTableOrderConsistency = ({ table, orders = [], activeReservation = null }) => {
  const expectedStatus = deriveTableLifecycle({
    table: { ...table, currentReservation: activeReservation || table?.currentReservation || null }, orders,
  });
  const activeOrders = orders.filter(isActiveOrder);
  const expectedCurrentOrder = activeOrders.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0]?._id || null;
  const errors = [];
  if (String(table?.status || "").toUpperCase() !== expectedStatus) errors.push("TABLE_STATUS_MISMATCH");
  if (String(table?.currentOrder || "") !== String(expectedCurrentOrder || "")) errors.push("CURRENT_ORDER_MISMATCH");
  if (Number(table?.activeOrderCount || 0) !== activeOrders.length) errors.push("ACTIVE_ORDER_COUNT_MISMATCH");
  if (expectedStatus === TABLE_LIFECYCLE.AVAILABLE && activeOrders.length) errors.push("AVAILABLE_WITH_ACTIVE_ORDER");
  return { valid: errors.length === 0, errors, expectedStatus, expectedCurrentOrder, activeOrderCount: activeOrders.length };
};
