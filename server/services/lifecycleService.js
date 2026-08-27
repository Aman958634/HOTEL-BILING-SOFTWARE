import ApiError from "../utils/ApiError.js";

export const TABLE_LIFECYCLE = Object.freeze({
  AVAILABLE: "AVAILABLE",
  ORDER_CREATED: "ORDER_CREATED",
  OCCUPIED: "OCCUPIED",
  BILL: "BILL",
  PAYMENT_VERIFIED: "PAYMENT_VERIFIED",
  PAID: "PAID",
  RESERVED: "RESERVED",
  MAINTENANCE: "MAINTENANCE",
});

export const ORDER_LIFECYCLE = Object.freeze({
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  PREPARING: "PREPARING",
  READY: "READY",
  SERVED: "SERVED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  VOIDED: "VOIDED",
});

const TABLE_TRANSITIONS = {
  AVAILABLE: ["ORDER_CREATED", "RESERVED", "MAINTENANCE"],
  ORDER_CREATED: ["OCCUPIED", "AVAILABLE"],
  OCCUPIED: ["BILL", "AVAILABLE", "MAINTENANCE"],
  BILL: ["PAYMENT_VERIFIED", "OCCUPIED", "AVAILABLE"],
  PAYMENT_VERIFIED: ["PAID", "BILL"],
  PAID: ["AVAILABLE"],
  RESERVED: ["AVAILABLE", "ORDER_CREATED", "MAINTENANCE"],
  MAINTENANCE: ["AVAILABLE"],
};

const ORDER_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED", "VOIDED"],
  CONFIRMED: ["PREPARING", "CANCELLED", "VOIDED"],
  PREPARING: ["READY", "CANCELLED", "VOIDED"],
  READY: ["SERVED", "CANCELLED", "VOIDED"],
  SERVED: ["COMPLETED", "CANCELLED", "VOIDED"],
  COMPLETED: [],
  CANCELLED: [],
  VOIDED: [],
};

const upper = (value) => String(value || "").trim().toUpperCase();

export const assertTableTransition = (from, to) => {
  const source = upper(from);
  const target = upper(to);
  if (source === target) return target;
  if (!TABLE_TRANSITIONS[source]?.includes(target)) {
    throw new ApiError(409, `Invalid table lifecycle transition from ${source || "unknown"} to ${target || "unknown"}`);
  }
  return target;
};

export const assertOrderTransition = (from, to) => {
  const source = upper(from);
  const target = upper(to);
  if (source === target) return target;
  if (!ORDER_TRANSITIONS[source]?.includes(target)) {
    throw new ApiError(409, `Invalid order lifecycle transition from ${source || "unknown"} to ${target || "unknown"}`);
  }
  return target;
};

/**
 * Computes the table lifecycle from persisted orders. UI reads never call this
 * function with a mutation intent; it is invoked only after a server command.
 */
export const deriveTableLifecycle = ({ table, orders = [] }) => {
  const active = orders.filter((order) => !order.isArchived && !["CANCELLED", "VOIDED"].includes(upper(order.status)));
  if (upper(table.status) === TABLE_LIFECYCLE.MAINTENANCE) return TABLE_LIFECYCLE.MAINTENANCE;
  if (!active.length) return table.currentReservation ? TABLE_LIFECYCLE.RESERVED : TABLE_LIFECYCLE.AVAILABLE;

  if (active.some((order) => upper(order.paymentStatus) === "PAID")) {
    // A paid order only frees the table after every sibling order is settled.
    const unsettled = active.some((order) => !["PAID", "CANCELLED", "VOIDED"].includes(upper(order.paymentStatus)));
    if (!unsettled) return table.currentReservation ? TABLE_LIFECYCLE.RESERVED : TABLE_LIFECYCLE.AVAILABLE;
  }
  if (active.some((order) => upper(order.paymentStatus) === "PAYMENT_VERIFIED")) return TABLE_LIFECYCLE.PAYMENT_VERIFIED;
  if (active.some((order) => upper(order.billingStatus) === "BILLED")) return TABLE_LIFECYCLE.BILL;
  if (active.some((order) => ["CONFIRMED", "PREPARING", "READY", "SERVED", "COMPLETED"].includes(upper(order.status)))) return TABLE_LIFECYCLE.OCCUPIED;
  return TABLE_LIFECYCLE.ORDER_CREATED;
};

export const isTerminalOrder = (status) => ["COMPLETED", "CANCELLED", "VOIDED"].includes(upper(status));
