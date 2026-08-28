import mongoose from "mongoose";
import Order from "../models/Order.js";
import KitchenStation from "../models/KitchenStation.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildRestaurantQuery } from "../utils/tenantUtils.js";
import {
  ORDER_STATUSES,
  addStatusHistoryEntry,
  buildLiveBoardOrderFilter,
  normalizeOrderForBoard,
} from "../services/orderService.js";
import {
  KITCHEN_ITEM_STATUSES,
  updateItemKitchenStatus,
  bulkUpdateItemsKitchenStatus,
  recalculateOrderStatusFromKitchen,
  buildKitchenTicket,
  buildKitchenStationMenuFilter,
  isOrderKitchenReady,
} from "../services/kitchenService.js";
import {
  emitOrderStatusChanged,
  emitKitchenItemStatusChanged,
  emitKitchenOrderStatusChanged,
} from "../socket/orderSocket.js";
import { consumeOrderInventory } from "../services/inventoryService.js";

const BOARD_ORDER_STATUSES = [
  ORDER_STATUSES.PENDING,
  ORDER_STATUSES.CONFIRMED,
  ORDER_STATUSES.PREPARING,
  ORDER_STATUSES.READY,
  ORDER_STATUSES.SERVED,
  ORDER_STATUSES.COMPLETED,
  ORDER_STATUSES.CANCELLED,
];

const normalizeKitchenItemStatus = (value) => {
  if (!value) return KITCHEN_ITEM_STATUSES.NEW;
  const upper = String(value).trim().toUpperCase();
  if (Object.values(KITCHEN_ITEM_STATUSES).includes(upper)) return upper;
  throw new ApiError(422, "Invalid kitchen item status");
};

const canUpdateKitchenItem = (role) => {
  return ["admin", "manager", "chef"].includes(String(role || "").toLowerCase());
};

const saveAndEmit = async (order, req, itemIndex, nextItemStatus) => {
  const previousStatus = String(order.status || "").toUpperCase();
  recalculateOrderStatusFromKitchen(order);
  const nextStatus = String(order.status || "").toUpperCase();

  if (nextItemStatus === KITCHEN_ITEM_STATUSES.PREPARING) {
    await consumeOrderInventory({ order, user: req.user._id, itemIndexes: itemIndex == null ? order.items.map((_, index) => index) : [itemIndex] });
  }

  if (previousStatus !== nextStatus) {
    addStatusHistoryEntry(order, nextStatus, req.user._id);
  }

  await order.save();


  const populated = await Order.findById(order._id)
    .populate("table", "tableNumber floor section")
    .populate("customer", "fullName phone")
    .populate("items.menuItem", "name kitchenStation")
    .lean();

  const ticket = buildKitchenTicket(populated);
  emitOrderStatusChanged(populated);

  if (nextItemStatus === KITCHEN_ITEM_STATUSES.READY && isOrderKitchenReady(populated)) {
    emitKitchenOrderStatusChanged(populated);
  } else {
    emitKitchenItemStatusChanged(populated, Number(itemIndex), nextItemStatus);
  }

  return ticket;
};

export const getKitchenTickets = asyncHandler(async (req, res) => {
  const base = await buildRestaurantQuery({}, req.user);
  const filters = buildLiveBoardOrderFilter(base);

  if (req.query.status) {
    const status = String(req.query.status).trim().toUpperCase();
    if (Object.values(ORDER_STATUSES).includes(status)) {
      filters.status = status;
    }
  }

  if (req.query.orderType) {
    filters.orderType = String(req.query.orderType).trim().toUpperCase();
  }

  if (req.query.search) {
    const pattern = new RegExp(String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filters.$or = [
      { orderNumber: pattern },
      { "table.tableNumber": pattern },
    ];
  }

  const stationFilter = await buildKitchenStationMenuFilter(req.query.station, req.user);
  if (Object.keys(stationFilter).length > 0) {
    filters.$and = [...(filters.$and || []), stationFilter];
  }

  const limit = Math.min(Number(req.query.limit) || 80, 200);
  const orders = await Order.find(filters)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("table", "tableNumber floor section")
    .populate("customer", "fullName phone")
    .populate("items.menuItem", "name kitchenStation")
    .lean();

  const tickets = orders.map((order) => buildKitchenTicket(normalizeOrderForBoard(order)));

  res.status(200).json(new ApiResponse(true, "Kitchen tickets fetched", tickets));
});

export const updateKitchenItemStatus = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.orderId)) {
    throw new ApiError(404, "Order not found");
  }

  if (!canUpdateKitchenItem(req.user.role)) {
    throw new ApiError(403, "You do not have permission to update kitchen items");
  }

  const order = await Order.findOne(await buildRestaurantQuery({ _id: req.params.orderId }, req.user));
  if (!order || order.isArchived) throw new ApiError(404, "Order not found");

  const nextStatus = normalizeKitchenItemStatus(req.body.kitchenStatus);
  updateItemKitchenStatus(order, req.params.itemIndex, nextStatus);

  const ticket = await saveAndEmit(order, req, req.params.itemIndex, nextStatus);

  res.status(200).json(new ApiResponse(true, "Kitchen item status updated", ticket));
});

export const bulkStartKitchenItems = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.orderId)) {
    throw new ApiError(404, "Order not found");
  }

  if (!canUpdateKitchenItem(req.user.role)) {
    throw new ApiError(403, "You do not have permission to update kitchen items");
  }

  const order = await Order.findOne(await buildRestaurantQuery({ _id: req.params.orderId }, req.user));
  if (!order || order.isArchived) throw new ApiError(404, "Order not found");

  const currentStatus = String(order.status || "").toUpperCase();
  if (currentStatus === ORDER_STATUSES.CANCELLED || currentStatus === ORDER_STATUSES.COMPLETED) {
    throw new ApiError(409, "Cannot start items for a completed or cancelled order");
  }

  bulkUpdateItemsKitchenStatus(order, KITCHEN_ITEM_STATUSES.PREPARING);

  const ticket = await saveAndEmit(order, req, null, KITCHEN_ITEM_STATUSES.PREPARING);

  res.status(200).json(new ApiResponse(true, "Kitchen items started", ticket));
});

export const bulkReadyKitchenItems = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.orderId)) {
    throw new ApiError(404, "Order not found");
  }

  if (!canUpdateKitchenItem(req.user.role)) {
    throw new ApiError(403, "You do not have permission to update kitchen items");
  }

  const order = await Order.findOne(await buildRestaurantQuery({ _id: req.params.orderId }, req.user));
  if (!order || order.isArchived) throw new ApiError(404, "Order not found");

  const currentStatus = String(order.status || "").toUpperCase();
  if (currentStatus === ORDER_STATUSES.CANCELLED || currentStatus === ORDER_STATUSES.COMPLETED) {
    throw new ApiError(409, "Cannot ready items for a completed or cancelled order");
  }

  bulkUpdateItemsKitchenStatus(order, KITCHEN_ITEM_STATUSES.READY);

  const ticket = await saveAndEmit(order, req, null, KITCHEN_ITEM_STATUSES.READY);

  res.status(200).json(new ApiResponse(true, "Kitchen items marked ready", ticket));
});

export const listKitchenStations = asyncHandler(async (req, res) => {
  const base = await buildRestaurantQuery({}, req.user);
  const stations = await KitchenStation.find(base).sort({ sortOrder: 1, name: 1 }).lean();
  res.status(200).json(new ApiResponse(true, "Kitchen stations fetched", stations));
});

export const createKitchenStation = asyncHandler(async (req, res) => {
  if (!["admin", "manager"].includes(String(req.user.role || "").toLowerCase())) {
    throw new ApiError(403, "Forbidden");
  }

  const restaurantId = await buildRestaurantQuery({}, req.user).then((q) => q.restaurant).catch(() => null);
  if (!restaurantId) {
    throw new ApiError(403, "Restaurant context required");
  }

  const station = await KitchenStation.create({
    name: String(req.body.name || "").trim(),
    restaurant: restaurantId,
    isActive: req.body.isActive !== false,
    sortOrder: Number(req.body.sortOrder || 0),
  });

  res.status(201).json(new ApiResponse(true, "Kitchen station created", station));
});

export const updateKitchenStation = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Station not found");
  if (!["admin", "manager"].includes(String(req.user.role || "").toLowerCase())) {
    throw new ApiError(403, "Forbidden");
  }

  const station = await KitchenStation.findOne(await buildRestaurantQuery({ _id: req.params.id }, req.user));
  if (!station) throw new ApiError(404, "Station not found");

  station.name = String(req.body.name || station.name).trim();
  station.isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : station.isActive;
  station.sortOrder = Number(req.body.sortOrder ?? station.sortOrder);

  await station.save();
  res.status(200).json(new ApiResponse(true, "Kitchen station updated", station));
});

export const deleteKitchenStation = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, "Station not found");
  if (!["admin", "manager"].includes(String(req.user.role || "").toLowerCase())) {
    throw new ApiError(403, "Forbidden");
  }

  const station = await KitchenStation.findOne(await buildRestaurantQuery({ _id: req.params.id }, req.user));
  if (!station) throw new ApiError(404, "Station not found");

  await KitchenStation.findByIdAndDelete(station._id);
  res.status(200).json(new ApiResponse(true, "Kitchen station deleted"));
});
