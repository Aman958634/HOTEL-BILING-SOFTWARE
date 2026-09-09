import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import Restaurant from "../models/Restaurant.js";
import RestaurantCommissionConfig from "../models/RestaurantCommissionConfig.js";
import SettlementTransaction from "../models/SettlementTransaction.js";
import { createActivity } from "../services/activityService.js";
import { fromPaise, safeSettlementTransaction, toPaise } from "../services/easySplitSettlementService.js";

const requireRestaurantId = (value) => {
  if (!mongoose.isValidObjectId(value)) throw new ApiError(422, "A valid restaurant id is required");
  return value;
};

const safeCommission = (config) => ({
  restaurant: config.restaurant,
  commissionType: config.commissionType,
  commissionBps: config.commissionBps,
  commissionPercentage: Number((config.commissionBps / 100).toFixed(2)),
  fixedAmount: fromPaise(config.fixedAmountPaise),
  updatedAt: config.updatedAt,
});

const parseBps = (value) => {
  const raw = String(value ?? "").trim();
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(raw)) throw new ApiError(422, "Commission percentage must have no more than two decimal places");
  const [whole, fraction = ""] = raw.split(".");
  const bps = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isSafeInteger(bps) || bps > 10000) throw new ApiError(422, "Commission percentage cannot exceed 100");
  return bps;
};

export const getCommissionConfig = asyncHandler(async (req, res) => {
  const restaurantId = requireRestaurantId(req.query.restaurantId);
  const restaurant = await Restaurant.findById(restaurantId).select("name").lean();
  if (!restaurant) throw new ApiError(404, "Restaurant not found");
  const config = await RestaurantCommissionConfig.findOne({ restaurant: restaurantId });
  const safe = safeCommission(config || { restaurant: restaurantId, commissionType: "NONE", commissionBps: 0, fixedAmountPaise: 0 });
  res.json(new ApiResponse(true, "Restaurant commission configuration fetched", { restaurant: { id: restaurant._id, name: restaurant.name }, commission: safe }));
});

export const updateCommissionConfig = asyncHandler(async (req, res) => {
  const restaurantId = requireRestaurantId(req.params.restaurantId);
  const restaurant = await Restaurant.findById(restaurantId).select("name").lean();
  if (!restaurant) throw new ApiError(404, "Restaurant not found");
  const commissionType = String(req.body.commissionType || "NONE").trim().toUpperCase();
  if (!["NONE", "PERCENTAGE", "FIXED"].includes(commissionType)) throw new ApiError(422, "Commission type is invalid");
  const commissionBps = commissionType === "PERCENTAGE" ? parseBps(req.body.commissionPercentage) : 0;
  const fixedAmountPaise = commissionType === "FIXED" ? toPaise(req.body.fixedAmount) : 0;
  const config = await RestaurantCommissionConfig.findOneAndUpdate(
    { restaurant: restaurantId },
    { $set: { commissionType, commissionBps, fixedAmountPaise, updatedBy: req.user._id } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await createActivity({ action: "RESTAURANT_COMMISSION_CONFIG_UPDATED", description: "Restaurant Cashfree commission configuration updated", performedBy: req.user._id, restaurantId, targetId: config._id, targetType: "RestaurantCommissionConfig", metadata: { commissionType, commissionBps, fixedAmount: fromPaise(fixedAmountPaise) } });
  res.json(new ApiResponse(true, "Restaurant commission configuration updated", { restaurant: { id: restaurant._id, name: restaurant.name }, commission: safeCommission(config) }));
});

export const listSettlementTransactions = asyncHandler(async (req, res) => {
  const restaurantId = req.query.restaurantId ? requireRestaurantId(req.query.restaurantId) : null;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const filter = { ...(restaurantId ? { restaurant: restaurantId } : {}), ...(req.query.status ? { settlementStatus: String(req.query.status).toUpperCase() } : {}) };
  const rows = await SettlementTransaction.find(filter).sort({ createdAt: -1 }).limit(limit).populate("restaurant", "name").lean();
  res.json(new ApiResponse(true, "Settlement allocations fetched", rows.map((item) => ({ ...safeSettlementTransaction(item), restaurantName: item.restaurant?.name || "" }))));
});
