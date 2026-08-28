import mongoose from "mongoose";
import Order from "../models/Order.js";
import Food from "../models/Food.js";
import ApiError from "../utils/ApiError.js";
import { ORDER_STATUSES } from "./orderService.js";
import { buildRestaurantQuery } from "../utils/tenantUtils.js";

export const KITCHEN_ITEM_STATUSES = {
  NEW: "NEW",
  PREPARING: "PREPARING",
  READY: "READY",
  SERVED: "SERVED",
  CANCELLED: "CANCELLED",
};

export const KITCHEN_ITEM_TRANSITIONS = {
  [KITCHEN_ITEM_STATUSES.NEW]: [KITCHEN_ITEM_STATUSES.PREPARING, KITCHEN_ITEM_STATUSES.CANCELLED],
  [KITCHEN_ITEM_STATUSES.PREPARING]: [KITCHEN_ITEM_STATUSES.READY, KITCHEN_ITEM_STATUSES.CANCELLED],
  [KITCHEN_ITEM_STATUSES.READY]: [KITCHEN_ITEM_STATUSES.SERVED, KITCHEN_ITEM_STATUSES.CANCELLED],
  [KITCHEN_ITEM_STATUSES.SERVED]: [],
  [KITCHEN_ITEM_STATUSES.CANCELLED]: [],
};

export const canTransitionKitchenItemStatus = (from, to) => {
  const source = String(from || KITCHEN_ITEM_STATUSES.NEW).toUpperCase();
  const target = String(to).toUpperCase();
  return (KITCHEN_ITEM_TRANSITIONS[source] || []).includes(target);
};

export const computeOrderKitchenPhase = (order) => {
  if (!order) return null;
  const status = String(order.status || "").toUpperCase();
  if (status === ORDER_STATUSES.CANCELLED) return "CANCELLED";

  const items = order.items || [];
  const activeItems = items.filter(
    (i) => String(i.kitchenStatus || KITCHEN_ITEM_STATUSES.NEW).toUpperCase() !== KITCHEN_ITEM_STATUSES.CANCELLED
  );

  if (activeItems.length === 0) return "CANCELLED";

  const statuses = activeItems.map((i) => String(i.kitchenStatus || KITCHEN_ITEM_STATUSES.NEW).toUpperCase());
  const allServed = statuses.every((s) => s === KITCHEN_ITEM_STATUSES.SERVED);
  // A served item remains kitchen-complete, so a mix of READY and SERVED
  // items means the order is still ready to be served as a whole.
  const allReady = statuses.every((s) => [KITCHEN_ITEM_STATUSES.READY, KITCHEN_ITEM_STATUSES.SERVED].includes(s));
  const anyReady = statuses.some((s) => s === KITCHEN_ITEM_STATUSES.READY);
  const anyPreparing = statuses.some((s) => s === KITCHEN_ITEM_STATUSES.PREPARING);

  if (allServed) return "COMPLETED";
  if (allReady) return "READY";
  if (anyReady && anyPreparing) return "PARTIALLY_READY";
  if (anyPreparing) return "PREPARING";
  return "NEW";
};

export const isOrderKitchenReady = (order) => {
  return computeOrderKitchenPhase(order) === "READY";
};

export const updateItemKitchenStatus = (order, itemIndex, nextStatus) => {
  if (!order || !Array.isArray(order.items)) {
    throw new ApiError(422, "Invalid order");
  }

  const index = Number(itemIndex);
  if (!Number.isInteger(index) || index < 0 || index >= order.items.length) {
    throw new ApiError(404, "Item not found in order");
  }

  const currentStatus = String(order.items[index].kitchenStatus || KITCHEN_ITEM_STATUSES.NEW).toUpperCase();
  const targetStatus = String(nextStatus).toUpperCase();

  if (!canTransitionKitchenItemStatus(currentStatus, targetStatus)) {
    throw new ApiError(409, `Cannot transition item from ${currentStatus} to ${targetStatus}`);
  }

  order.items[index].kitchenStatus = targetStatus;
  return order;
};

export const bulkUpdateItemsKitchenStatus = (order, nextStatus) => {
  if (!order || !Array.isArray(order.items)) {
    throw new ApiError(422, "Invalid order");
  }

  const targetStatus = String(nextStatus).toUpperCase();
  let changed = false;

  order.items.forEach((item) => {
    const currentStatus = String(item.kitchenStatus || KITCHEN_ITEM_STATUSES.NEW).toUpperCase();
    if (canTransitionKitchenItemStatus(currentStatus, targetStatus)) {
      item.kitchenStatus = targetStatus;
      changed = true;
    }
  });

  if (!changed) {
    throw new ApiError(409, `No items can transition to ${targetStatus}`);
  }

  return order;
};

export const recalculateOrderStatusFromKitchen = (order) => {
  if (!order) return;
  const phase = computeOrderKitchenPhase(order);
  const currentStatus = String(order.status || "").toUpperCase();

  if (phase === "COMPLETED") {
    order.kitchenStatus = "COMPLETED";
    if (![ORDER_STATUSES.SERVED, ORDER_STATUSES.COMPLETED, ORDER_STATUSES.CANCELLED].includes(currentStatus)) {
      order.status = ORDER_STATUSES.SERVED;
    }
  } else if (phase === "READY") {
    order.kitchenStatus = "READY";
  } else if (["PREPARING", "PARTIALLY_READY"].includes(phase)) {
    order.kitchenStatus = "PREPARING";
  } else {
    order.kitchenStatus = "PENDING";
  }

  if (phase === "READY" && currentStatus !== ORDER_STATUSES.READY && currentStatus !== ORDER_STATUSES.SERVED && currentStatus !== ORDER_STATUSES.COMPLETED) {
    order.status = ORDER_STATUSES.READY;
  } else if (phase === "PREPARING" && currentStatus === ORDER_STATUSES.PENDING) {
    order.status = ORDER_STATUSES.CONFIRMED;
  } else if (phase === "PARTIALLY_READY" && currentStatus === ORDER_STATUSES.PENDING) {
    order.status = ORDER_STATUSES.CONFIRMED;
  }
};

export const buildKitchenTicket = (order) => {
  if (!order) return null;
  const obj = order.toObject ? order.toObject() : order;
  return {
    orderId: obj._id,
    orderNumber: obj.orderNumber,
    orderType: obj.orderType,
    status: obj.status,
    kitchenPhase: computeOrderKitchenPhase(obj),
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    table: obj.table,
    customer: obj.customer,
    restaurant: obj.restaurant,
    items: (obj.items || []).map((item, idx) => ({
      index: idx,
      name: item.name || "Item",
      quantity: item.quantity || 1,
      price: item.price || 0,
      subtotal: item.subtotal || 0,
      specialInstructions: item.specialInstructions || "",
      kitchenStatus: item.kitchenStatus || KITCHEN_ITEM_STATUSES.NEW,
      menuItem: item.menuItem,
    })),
  };
};

export const buildKitchenStationMenuFilter = async (stationId, user) => {
  if (!stationId || !mongoose.isValidObjectId(stationId)) return {};
  const base = await buildRestaurantQuery({}, user);
  const foodIds = await Food.find({ ...base, kitchenStation: stationId }).select("_id").lean();
  if (!foodIds.length) return { _id: "no-match" };
  return { "items.menuItem": { $in: foodIds.map((f) => f._id) } };
};
