import mongoose from "mongoose";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Reservation from "../models/Reservation.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { createActivity } from "../services/activityService.js";
import { findOrCreateRestaurantCustomer, getAuthorizedRestaurantIds, validOrderMatch } from "../services/customerService.js";
import { loyaltySummaryForCustomer } from "../services/loyaltyService.js";

const pagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const customerAggregation = ({ restaurantIds, query = {}, includeArchived = false }) => {
  const search = String(query.search || "").trim();
  const customerMatch = { role: "customer", ...(includeArchived ? {} : { isCrmArchived: { $ne: true } }) };
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    customerMatch.$or = [{ fullName: regex }, { email: regex }, { phone: regex }];
  }

  const validOrders = validOrderMatch(restaurantIds);
  return [
    { $match: customerMatch },
    { $lookup: { from: "orders", let: { customerId: "$_id" }, pipeline: [
      { $match: { $expr: { $eq: ["$customer", "$$customerId"] }, ...validOrders } },
      { $group: { _id: null, totalOrders: { $sum: 1 }, totalSpent: { $sum: "$total" }, firstOrderAt: { $min: "$createdAt" }, lastOrderAt: { $max: "$createdAt" }, dineInVisits: { $sum: { $cond: [{ $eq: ["$orderType", "DINE_IN"] }, 1, 0] } }, lastDineInAt: { $max: { $cond: [{ $eq: ["$orderType", "DINE_IN"] }, "$createdAt", null] } } } },
    ], as: "orderMetrics" } },
    { $lookup: { from: "reservations", let: { customerId: "$_id" }, pipeline: [
      { $match: { $expr: { $eq: ["$customer", "$$customerId"] }, restaurant: { $in: restaurantIds } } },
      { $group: { _id: null, totalReservations: { $sum: 1 }, completedReservations: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }, lastCompletedReservationAt: { $max: { $cond: [{ $eq: ["$status", "completed"] }, "$date", null] } } } },
    ], as: "reservationMetrics" } },
    { $addFields: {
      metrics: { $ifNull: [{ $arrayElemAt: ["$orderMetrics", 0] }, { totalOrders: 0, totalSpent: 0, dineInVisits: 0 }] },
      reservationMetrics: { $ifNull: [{ $arrayElemAt: ["$reservationMetrics", 0] }, { totalReservations: 0, completedReservations: 0 }] },
    } },
    { $addFields: {
      totalOrders: "$metrics.totalOrders", totalSpent: "$metrics.totalSpent", firstOrderAt: "$metrics.firstOrderAt", lastOrderAt: "$metrics.lastOrderAt",
      averageOrderValue: { $cond: [{ $gt: ["$metrics.totalOrders", 0] }, { $divide: ["$metrics.totalSpent", "$metrics.totalOrders"] }, 0] },
      totalVisits: { $add: ["$metrics.dineInVisits", "$reservationMetrics.completedReservations"] },
      // Delivery/pickup remains last-order activity. A visit is only a dine-in
      // order or a completed reservation.
      lastVisitAt: { $max: ["$metrics.lastDineInAt", "$reservationMetrics.lastCompletedReservationAt"] },
    } },
    { $match: { $or: [
      { restaurant: { $in: restaurantIds } },
      { "customerRestaurants.restaurant": { $in: restaurantIds } },
      { totalOrders: { $gt: 0 } },
      { "reservationMetrics.totalReservations": { $gt: 0 } },
    ] } },
    ...(query.tag ? [{ $match: { tags: { $elemMatch: { restaurant: { $in: restaurantIds }, name: String(query.tag).trim() } } } }] : []),
    { $addFields: {
      tags: { $map: { input: { $filter: { input: { $ifNull: ["$tags", []] }, as: "tag", cond: { $in: ["$$tag.restaurant", restaurantIds] } } }, as: "tag", in: "$$tag.name" } },
      customerNotes: { $filter: { input: { $ifNull: ["$customerNotes", []] }, as: "note", cond: { $in: ["$$note.restaurant", restaurantIds] } } },
    } },
  ];
};

const segmentMatch = (segment) => {
  const now = new Date();
  const thirtyDays = new Date(now); thirtyDays.setDate(thirtyDays.getDate() - 30);
  const ninetyDays = new Date(now); ninetyDays.setDate(ninetyDays.getDate() - 90);
  if (segment === "new") return { createdAt: { $gte: thirtyDays } };
  if (segment === "returning") return { totalOrders: { $gt: 1 } };
  if (segment === "recent") return { lastVisitAt: { $gte: thirtyDays } };
  if (segment === "inactive") return { $or: [{ lastVisitAt: { $lt: ninetyDays } }, { lastVisitAt: null }, { lastVisitAt: { $exists: false } }] };
  return null;
};

const getAccessibleCustomer = async ({ id, restaurantIds, includeArchived = true }) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Customer not found");
  const pipeline = [...customerAggregation({ restaurantIds, includeArchived }), { $match: { _id: new mongoose.Types.ObjectId(id) } }, { $limit: 1 }];
  const [customer] = await User.aggregate(pipeline);
  if (!customer) throw new ApiError(404, "Customer not found");
  return customer;
};

export const listCustomers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const restaurantIds = await getAuthorizedRestaurantIds(req.user);
  const pipeline = customerAggregation({ restaurantIds, query: req.query });
  const segment = segmentMatch(req.query.segment);
  if (segment) pipeline.push({ $match: segment });
  pipeline.push({ $facet: {
    rows: [{ $sort: { lastVisitAt: -1, createdAt: -1 } }, { $skip: skip }, { $limit: limit }, { $project: { password: 0, refreshToken: 0, customerNotes: 0, orderMetrics: 0, reservationMetrics: 0, metrics: 0 } }],
    total: [{ $count: "count" }],
    summary: [{ $group: { _id: null, totalCustomers: { $sum: 1 }, newCustomers: { $sum: { $cond: [{ $gte: ["$createdAt", new Date(Date.now() - 30 * 86400000)] }, 1, 0] } }, returningCustomers: { $sum: { $cond: [{ $gt: ["$totalOrders", 1] }, 1, 0] } }, recentlyActive: { $sum: { $cond: [{ $gte: ["$lastVisitAt", new Date(Date.now() - 30 * 86400000)] }, 1, 0] } }, totalSpend: { $sum: "$totalSpent" } } }],
  } });
  const [result] = await User.aggregate(pipeline);
  const summary = result?.summary?.[0] || {};
  const totalCustomers = summary.totalCustomers || 0;
  res.status(200).json(new ApiResponse(true, "Customers fetched", result?.rows || [], { page, limit, total: result?.total?.[0]?.count || 0, totalPages: Math.ceil((result?.total?.[0]?.count || 0) / limit), summary: { totalCustomers, newCustomers: summary.newCustomers || 0, returningCustomers: summary.returningCustomers || 0, recentlyActive: summary.recentlyActive || 0, averageCustomerValue: totalCustomers ? (summary.totalSpend || 0) / totalCustomers : 0 } }));
});

export const createCustomer = asyncHandler(async (req, res) => {
  const restaurantIds = await getAuthorizedRestaurantIds(req.user);
  const restaurantId = req.user.restaurant || restaurantIds[0];
  if (!restaurantId) throw new ApiError(403, "Restaurant context is required");
  const { customer, created } = await findOrCreateRestaurantCustomer({ ...req.body, restaurantId });
  if (created && Array.isArray(req.body.tags)) {
    customer.tags = [...new Set(req.body.tags.map((tag) => String(tag).trim()).filter(Boolean))].map((name) => ({ restaurant: restaurantId, name }));
    await customer.save();
  }
  await createActivity({ action: created ? "Customer Created" : "Customer Linked", description: `Customer ${customer.fullName} ${created ? "created" : "linked"}`, performedBy: req.user._id, restaurantId, targetId: customer._id, targetType: "Customer" });
  res.status(created ? 201 : 200).json(new ApiResponse(true, created ? "Customer created" : "Existing customer linked", customer));
});

export const getCustomerProfile = asyncHandler(async (req, res) => {
  const restaurantIds = await getAuthorizedRestaurantIds(req.user);
  const customer = await getAccessibleCustomer({ id: req.params.id, restaurantIds });
  const customerId = customer._id;
  const [orders, reservations, frequentItems, orderTypes, loyalty] = await Promise.all([
    Order.find({ customer: customerId, restaurant: { $in: restaurantIds }, isArchived: { $ne: true } }).select("orderNumber orderType orderSource total paymentStatus status createdAt items").sort({ createdAt: -1 }).limit(50).lean(),
    Reservation.find({ customer: customerId, restaurant: { $in: restaurantIds } }).populate("table", "tableNumber").select("date guests status notes table createdAt").sort({ date: -1 }).limit(50).lean(),
    Order.aggregate([{ $match: { customer: customerId, ...validOrderMatch(restaurantIds) } }, { $unwind: "$items" }, { $group: { _id: "$items.name", count: { $sum: "$items.quantity" } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 5 }]),
    Order.aggregate([{ $match: { customer: customerId, ...validOrderMatch(restaurantIds) } }, { $group: { _id: "$orderType", count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 1 }]),
    loyaltySummaryForCustomer({ customerId, restaurantIds }),
  ]);
  const activity = [
    { type: "CUSTOMER_CREATED", at: customer.createdAt, label: "Customer profile created" },
    ...(customer.customerNotes || []).map((note) => ({ type: "NOTE", at: note.createdAt, label: "Internal note added", detail: note.text, createdBy: note.createdBy })),
    ...orders.slice(0, 15).map((order) => ({ type: "ORDER", at: order.createdAt, label: `Order #${order.orderNumber}`, detail: `${order.status} · ${order.total}` })),
    ...reservations.slice(0, 15).map((reservation) => ({ type: "RESERVATION", at: reservation.date, label: `Reservation ${reservation.status}`, detail: `${reservation.guests} guests` })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 40);
  res.status(200).json(new ApiResponse(true, "Customer profile fetched", { customer, orders, reservations, loyalty, preferences: { favouriteItems: frequentItems.map((item) => ({ name: item._id, count: item.count })), commonOrderType: orderTypes[0]?._id || null, recentItems: [...new Set(orders.flatMap((order) => (order.items || []).map((item) => item.name)))].slice(0, 8) }, activity }));
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const restaurantIds = await getAuthorizedRestaurantIds(req.user);
  const customer = await getAccessibleCustomer({ id: req.params.id, restaurantIds });
  const restaurantId = req.user.restaurant || restaurantIds[0];
  const customerDocument = await User.findById(customer._id).select("fullName email phone phoneNormalized address tags customerNotes role");
  const allowed = ["fullName", "email", "phone", "address"];
  for (const key of allowed) if (req.body[key] !== undefined) customerDocument[key] = String(req.body[key]).trim();
  if (req.body.phone !== undefined) customerDocument.phoneNormalized = String(req.body.phone).replace(/\D/g, "");
  if (req.body.tags !== undefined) {
    const retained = (customerDocument.tags || []).filter((tag) => !restaurantIds.some((id) => String(id) === String(tag.restaurant)));
    const currentTags = [...new Set((req.body.tags || []).map((tag) => String(tag).trim()).filter(Boolean))].map((name) => ({ restaurant: restaurantId, name }));
    customerDocument.tags = [...retained, ...currentTags];
  }
  if (req.body.note) customerDocument.customerNotes.push({ text: String(req.body.note).trim(), restaurant: restaurantId, createdBy: req.user._id, createdAt: new Date() });
  await customerDocument.save();
  await createActivity({ action: req.body.note ? "Customer Note Added" : "Customer Updated", description: `Customer ${customerDocument.fullName} updated`, performedBy: req.user._id, restaurantId, targetId: customer._id, targetType: "Customer" });
  res.status(200).json(new ApiResponse(true, "Customer updated"));
});

export const archiveCustomer = asyncHandler(async (req, res) => {
  const restaurantIds = await getAuthorizedRestaurantIds(req.user);
  const customer = await getAccessibleCustomer({ id: req.params.id, restaurantIds });
  await User.updateOne({ _id: customer._id }, { $set: { isCrmArchived: true } });
  await createActivity({ action: "Customer Archived", description: `Customer ${customer.fullName} archived from CRM`, performedBy: req.user._id, restaurantId: req.user.restaurant || restaurantIds[0], targetId: customer._id, targetType: "Customer" });
  res.status(200).json(new ApiResponse(true, "Customer archived"));
});
