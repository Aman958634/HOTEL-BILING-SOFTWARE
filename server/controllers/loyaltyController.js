import LoyaltyAccount from "../models/LoyaltyAccount.js";
import LoyaltyReward from "../models/LoyaltyReward.js";
import LoyaltyTransaction from "../models/LoyaltyTransaction.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { createActivity } from "../services/activityService.js";
import { getAuthorizedRestaurantIds } from "../services/customerService.js";
import { adjustLoyaltyPoints, enrollLoyaltyCustomer, getLoyaltyAccount, getLoyaltySettings, listLoyaltyAccounts, redeemLoyaltyPoints, updateLoyaltySettings } from "../services/loyaltyService.js";

const restaurantContext = async (req) => {
  const ids = await getAuthorizedRestaurantIds(req.user);
  const restaurant = req.user.restaurant || ids[0];
  if (!restaurant) throw new ApiError(403, "Restaurant context is required");
  return { restaurant, restaurantIds: ids };
};
const pageValues = (query) => ({ page: Math.max(Number(query.page) || 1, 1), limit: Math.min(Math.max(Number(query.limit) || 20, 1), 100) });

export const getSettings = asyncHandler(async (req, res) => {
  const { restaurant } = await restaurantContext(req);
  res.json(new ApiResponse(true, "Loyalty settings fetched", await getLoyaltySettings(restaurant)));
});

export const saveSettings = asyncHandler(async (req, res) => {
  const { restaurant } = await restaurantContext(req);
  const settings = await updateLoyaltySettings(restaurant, req.body);
  await createActivity({ action: "Loyalty Settings Updated", description: "Loyalty earning and redemption rules updated", performedBy: req.user._id, restaurantId: restaurant, targetId: settings._id, targetType: "LoyaltySettings" });
  res.json(new ApiResponse(true, "Loyalty settings updated", settings));
});

export const enrollCustomer = asyncHandler(async (req, res) => {
  const { restaurant, restaurantIds } = await restaurantContext(req);
  // Customer CRM access is established by an existing customer/order relation;
  // never trust a customer id alone from another tenant.
  const customer = await (await import("../models/User.js")).default.findOne({ _id: req.params.customerId, role: "customer", $or: [{ restaurant: { $in: restaurantIds } }, { "customerRestaurants.restaurant": { $in: restaurantIds } }] });
  if (!customer) throw new ApiError(404, "Customer not found");
  const account = await enrollLoyaltyCustomer({ customerId: customer._id, restaurantId: restaurant });
  await createActivity({ action: "Loyalty Customer Enrolled", description: `Customer ${customer.fullName} enrolled in loyalty`, performedBy: req.user._id, restaurantId: restaurant, targetId: account._id, targetType: "LoyaltyAccount" });
  res.status(201).json(new ApiResponse(true, "Customer enrolled in loyalty", account));
});

export const getCustomerAccount = asyncHandler(async (req, res) => {
  const { restaurant, restaurantIds } = await restaurantContext(req);
  const account = await getLoyaltyAccount(req.params.customerId, restaurant);
  if (!account) return res.json(new ApiResponse(true, "Customer is not enrolled in loyalty", { account: null, transactions: [] }));
  const customerIds = [String(req.params.customerId)];
  const accessible = await (await import("../models/User.js")).default.exists({ _id: { $in: customerIds }, $or: [{ restaurant: { $in: restaurantIds } }, { "customerRestaurants.restaurant": { $in: restaurantIds } }] });
  if (!accessible) throw new ApiError(404, "Customer not found");
  const transactions = await LoyaltyTransaction.find({ account: account._id, restaurant: restaurant }).sort({ createdAt: -1 }).limit(100).populate("order", "orderNumber").lean();
  res.json(new ApiResponse(true, "Loyalty account fetched", { account, transactions }));
});

export const listAccounts = asyncHandler(async (req, res) => {
  const { restaurantIds } = await restaurantContext(req); const { page, limit } = pageValues(req.query);
  const result = await listLoyaltyAccounts({ restaurantIds, page, limit, search: String(req.query.search || "").trim() });
  res.json(new ApiResponse(true, "Loyalty members fetched", result.rows, { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) }));
});

export const listTransactions = asyncHandler(async (req, res) => {
  const { restaurantIds } = await restaurantContext(req); const { page, limit } = pageValues(req.query);
  const filter = { restaurant: { $in: restaurantIds } };
  if (req.query.type) filter.type = req.query.type;
  if (req.query.customerId) filter.customer = req.query.customerId;
  if (req.query.dateFrom || req.query.dateTo) filter.createdAt = { ...(req.query.dateFrom ? { $gte: new Date(req.query.dateFrom) } : {}), ...(req.query.dateTo ? { $lte: new Date(req.query.dateTo) } : {}) };
  const [rows, total] = await Promise.all([LoyaltyTransaction.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("customer", "fullName phone email").populate("order", "orderNumber").lean(), LoyaltyTransaction.countDocuments(filter)]);
  res.json(new ApiResponse(true, "Loyalty transactions fetched", rows, { page, limit, total, totalPages: Math.ceil(total / limit) }));
});

export const adjustPoints = asyncHandler(async (req, res) => {
  const { restaurant } = await restaurantContext(req);
  const account = await LoyaltyAccount.findOne({ _id: req.body.accountId, restaurant });
  if (!account) throw new ApiError(404, "Loyalty account not found");
  const result = await adjustLoyaltyPoints({ account, points: req.body.points, reason: String(req.body.reason || "").trim(), createdBy: req.user._id });
  await createActivity({ action: "Loyalty Points Adjusted", description: `Adjusted loyalty points: ${req.body.points}`, performedBy: req.user._id, restaurantId: restaurant, targetId: account._id, targetType: "LoyaltyAccount" });
  res.json(new ApiResponse(true, "Loyalty points adjusted", result));
});

export const redeemPoints = asyncHandler(async (req, res) => {
  const { restaurant } = await restaurantContext(req);
  const result = await redeemLoyaltyPoints({ orderId: req.body.orderId, customerId: req.body.customerId, restaurantId: restaurant, points: req.body.points, rewardId: req.body.rewardId || null, idempotencyKey: String(req.get("Idempotency-Key") || req.body.idempotencyKey || "").trim(), createdBy: req.user._id });
  await createActivity({ action: "Loyalty Points Redeemed", description: "Loyalty redemption applied to an order", performedBy: req.user._id, restaurantId: restaurant, targetId: result.transaction._id, targetType: "LoyaltyTransaction" });
  res.json(new ApiResponse(true, result.idempotent ? "Loyalty redemption already applied" : "Loyalty redemption applied", result));
});

export const listRewards = asyncHandler(async (req, res) => {
  const { restaurant } = await restaurantContext(req);
  res.json(new ApiResponse(true, "Loyalty rewards fetched", await LoyaltyReward.find({ restaurant }).sort({ active: -1, createdAt: -1 }).lean()));
});

export const createReward = asyncHandler(async (req, res) => {
  const { restaurant } = await restaurantContext(req);
  const reward = await LoyaltyReward.create({ ...req.body, restaurant });
  res.status(201).json(new ApiResponse(true, "Loyalty reward created", reward));
});

export const updateReward = asyncHandler(async (req, res) => {
  const { restaurant } = await restaurantContext(req);
  const { restaurant: _ignoredRestaurant, _id: _ignoredId, ...updates } = req.body;
  const reward = await LoyaltyReward.findOneAndUpdate({ _id: req.params.id, restaurant }, { $set: updates }, { new: true, runValidators: true });
  if (!reward) throw new ApiError(404, "Loyalty reward not found");
  res.json(new ApiResponse(true, "Loyalty reward updated", reward));
});
