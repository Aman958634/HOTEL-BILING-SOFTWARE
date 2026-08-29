import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPagination } from "../utils/pagination.js";

const parseBoolean = (value) => {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes"].includes(String(value).toLowerCase());
};

const buildBaseFilters = (req) => {
  const filters = { user: req.user._id };

  if (req.user.role !== "super_admin" && req.user.restaurant && mongoose.isValidObjectId(req.user.restaurant)) {
    filters.$or = [
      { restaurantId: req.user.restaurant },
      { restaurantId: null },
    ];
  }

  return filters;
};

export const getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const sortBy = req.query.sortBy || "createdAt";
  const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

  const filters = buildBaseFilters(req);

  if (req.query.search) {
    const escaped = String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filters.$and = [...(filters.$and || []), { $or: [{ title: { $regex: escaped, $options: "i" } }, { message: { $regex: escaped, $options: "i" } }] }];
  }
  if (req.query.type) {
    filters.type = req.query.type;
  }
  if (req.query.category) filters.category = String(req.query.category).toUpperCase();
  if (req.query.severity) filters.severity = String(req.query.severity).toUpperCase();
  if (req.query.dateFrom || req.query.dateTo) filters.createdAt = { ...(req.query.dateFrom ? { $gte: new Date(req.query.dateFrom) } : {}), ...(req.query.dateTo ? { $lte: new Date(req.query.dateTo) } : {}) };
  if (req.query.isRead !== undefined) {
    const parsed = parseBoolean(req.query.isRead);
    if (parsed !== undefined) filters.isRead = parsed;
  }

  const [items, total] = await Promise.all([
    Notification.find(filters)
      .populate("user", "fullName email role")
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(filters),
  ]);

  res.status(200).json(
    new ApiResponse(true, "Notifications fetched", items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  );
});

export const getNotificationSummary = asyncHandler(async (req, res) => {
  const baseFilters = buildBaseFilters(req);
  const [total, unread, typeCounts] = await Promise.all([
    Notification.countDocuments(baseFilters),
    Notification.countDocuments({ ...baseFilters, isRead: false }),
    Notification.aggregate([
      { $match: baseFilters },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
  ]);

  const counts = typeCounts.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  res.status(200).json(
    new ApiResponse(true, "Notification summary fetched", {
      total,
      unread,
      newOrder: counts["NEW_ORDER"] || 0,
      paymentReceived: counts["PAYMENT_RECEIVED"] || 0,
      orderCancelled: counts["ORDER_CANCELLED"] || 0,
      subscriptionExpiring: counts["SUBSCRIPTION_EXPIRING"] || 0,
      lowStock: counts["LOW_STOCK"] || 0,
      newStaff: counts["NEW_STAFF"] || 0,
      order: counts["order"] || 0,
      payment: counts["payment"] || 0,
      reservation: counts["reservation"] || 0,
      system: counts["system"] || 0,
    })
  );
});

export const updateNotificationStatus = asyncHandler(async (req, res) => {
  const { isRead } = req.body;
  if (typeof isRead !== "boolean") {
    throw new ApiError(400, "isRead must be a boolean");
  }

  const filters = { _id: req.params.id, user: req.user._id };
  if (req.user.role !== "super_admin" && req.user.restaurant && mongoose.isValidObjectId(req.user.restaurant)) {
    filters.$or = [
      { restaurantId: req.user.restaurant },
      { restaurantId: null },
    ];
  }

  const notification = await Notification.findOneAndUpdate(
    filters,
    { isRead, readAt: isRead ? new Date() : null },
    { new: true, runValidators: true }
  );

  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }

  res.status(200).json(new ApiResponse(true, "Notification updated", notification));
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const filters = { user: req.user._id, isRead: false };
  if (req.user.role !== "super_admin" && req.user.restaurant && mongoose.isValidObjectId(req.user.restaurant)) {
    filters.$or = [
      { restaurantId: req.user.restaurant },
      { restaurantId: null },
    ];
  }

  const result = await Notification.updateMany(filters, { isRead: true, readAt: new Date() });
  res.status(200).json(new ApiResponse(true, "All notifications marked as read", { modifiedCount: result.modifiedCount }));
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const filters = { _id: req.params.id, user: req.user._id };
  if (req.user.role !== "super_admin" && req.user.restaurant && mongoose.isValidObjectId(req.user.restaurant)) {
    filters.$or = [
      { restaurantId: req.user.restaurant },
      { restaurantId: null },
    ];
  }

  const notification = await Notification.findOneAndDelete(filters);
  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }
  res.status(200).json(new ApiResponse(true, "Notification deleted"));
});
