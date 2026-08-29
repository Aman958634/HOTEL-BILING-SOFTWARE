import KotTicket from "../models/KotTicket.js";
import { emitKotCreated, emitKotUpdated } from "../socket/orderSocket.js";
import { NOTIFICATION_EVENTS, publishBusinessEvent } from "./notificationService.js";

export const KOT_ITEM_STATUSES = {
  NEW: "NEW",
  PREPARING: "PREPARING",
  READY: "READY",
  SERVED: "SERVED",
  CANCELLED: "CANCELLED",
};

const activeItems = (items) => items.filter((item) => item.status !== KOT_ITEM_STATUSES.CANCELLED);

export const deriveKotStatus = (items, orderStatus = "") => {
  if (["CANCELLED", "REJECTED"].includes(String(orderStatus).toUpperCase())) return "CANCELLED";
  const active = activeItems(items || []);
  if (!active.length) return "CANCELLED";
  const statuses = active.map((item) => String(item.status || "NEW").toUpperCase());
  if (statuses.every((status) => status === KOT_ITEM_STATUSES.SERVED)) return "SERVED";
  if (statuses.every((status) => [KOT_ITEM_STATUSES.READY, KOT_ITEM_STATUSES.SERVED].includes(status))) return "READY";
  if (statuses.some((status) => status === KOT_ITEM_STATUSES.PREPARING)) return "PREPARING";
  return "NEW";
};

const toKotItems = (order) =>
  (order.items || []).map((item, orderItemIndex) => ({
    orderItemIndex,
    menuItem: item.menuItem?._id || item.menuItem || null,
    name: item.name || "Item",
    quantity: Number(item.quantity || item.qty || 1),
    specialInstructions: item.specialInstructions || "",
    status: String(item.kitchenStatus || KOT_ITEM_STATUSES.NEW).toUpperCase(),
  }));

/** Create the KOT once and append/reconcile order items on later order edits. */
export const syncKotForOrder = async (order) => {
  if (!order?._id) return null;
  const items = toKotItems(order);
  const status = deriveKotStatus(items, order.status);
  let kot = await KotTicket.findOne({ orderId: order._id });
  const created = !kot;

  if (!kot) {
    kot = new KotTicket({
      orderId: order._id,
      tableId: order.table?._id || order.table || null,
      restaurant: order.restaurant || null,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      items,
      status,
    });
  } else {
    kot.tableId = order.table?._id || order.table || null;
    kot.restaurant = order.restaurant || kot.restaurant;
    kot.orderNumber = order.orderNumber;
    kot.orderType = order.orderType;
    kot.items = items;
    kot.status = status;
  }

  await kot.save();
  if (created) {
    emitKotCreated(kot);
    await publishBusinessEvent({ eventType: NOTIFICATION_EVENTS.KOT_CREATED, restaurantId: kot.restaurant, entityType: "KotTicket", entityId: kot._id, payload: { kotNumber: kot.kotNumber || kot.orderNumber, orderNumber: kot.orderNumber } });
  }
  else emitKotUpdated(kot);
  return kot;
};

export const buildKitchenTicketFromKot = (kot) => {
  if (!kot) return null;
  const data = kot.toObject ? kot.toObject() : kot;
  const table = data.tableId;
  return {
    kotId: data._id,
    orderId: data.orderId?._id || data.orderId,
    orderNumber: data.orderNumber,
    orderType: data.orderType,
    status: data.orderId?.status || (data.status === "SERVED" ? "SERVED" : "PENDING"),
    kitchenStatus: data.orderId?.kitchenStatus || (data.status === "READY" ? "READY" : data.status === "SERVED" ? "COMPLETED" : data.status === "PREPARING" ? "PREPARING" : "PENDING"),
    kitchenPhase: data.status === "SERVED" ? "COMPLETED" : data.status,
    kotStatus: data.status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    table,
    customer: data.orderId?.customer || null,
    restaurant: data.restaurant,
    items: (data.items || []).map((item) => ({
      index: item.orderItemIndex,
      name: item.name,
      quantity: item.quantity,
      specialInstructions: item.specialInstructions || "",
      kitchenStatus: item.status,
      menuItem: item.menuItem,
    })),
  };
};
