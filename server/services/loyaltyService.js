import mongoose from "mongoose";
import LoyaltyAccount from "../models/LoyaltyAccount.js";
import LoyaltyReward from "../models/LoyaltyReward.js";
import LoyaltySettings from "../models/LoyaltySettings.js";
import LoyaltyTransaction from "../models/LoyaltyTransaction.js";
import Order from "../models/Order.js";
import ApiError from "../utils/ApiError.js";
import { calculateOrderAmounts } from "./orderCalculationService.js";

const DEFAULT_SETTINGS = {
  enabled: false,
  spendPerPoint: 100,
  minimumOrderAmount: 0,
  pointValue: 0.5,
  minimumRedemptionPoints: 100,
  maxRedemptionPercent: 25,
  eligibleOrderTypes: ["DINE_IN", "TAKEAWAY", "DELIVERY", "PICKUP"],
  includeTaxes: false,
  includeDeliveryCharge: false,
  maxPointsPerOrder: null,
  expiryMonths: 0,
};

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const asId = (value) => String(value?._id || value || "");
const sessionOptions = (session) => session ? { session } : undefined;

export const getLoyaltySettings = async (restaurantId, { create = false } = {}) => {
  if (!restaurantId) throw new ApiError(403, "Restaurant context is required");
  let settings = await LoyaltySettings.findOne({ restaurant: restaurantId });
  if (!settings && create) settings = await LoyaltySettings.create({ restaurant: restaurantId, ...DEFAULT_SETTINGS });
  return settings || { ...DEFAULT_SETTINGS, restaurant: restaurantId, isDefault: true };
};

export const updateLoyaltySettings = async (restaurantId, values) => {
  const allowed = ["enabled", "spendPerPoint", "minimumOrderAmount", "pointValue", "minimumRedemptionPoints", "maxRedemptionPercent", "eligibleOrderTypes", "includeTaxes", "includeDeliveryCharge", "maxPointsPerOrder", "expiryMonths"];
  const update = {};
  for (const key of allowed) if (values[key] !== undefined) update[key] = values[key];
  return LoyaltySettings.findOneAndUpdate({ restaurant: restaurantId }, { $set: update, $setOnInsert: { restaurant: restaurantId } }, { new: true, upsert: true, runValidators: true });
};

export const getLoyaltyAccount = (customerId, restaurantId) => LoyaltyAccount.findOne({ customer: customerId, restaurant: restaurantId });

export const enrollLoyaltyCustomer = async ({ customerId, restaurantId }) => {
  try {
    return await LoyaltyAccount.findOneAndUpdate(
      { customer: customerId, restaurant: restaurantId },
      { $setOnInsert: { customer: customerId, restaurant: restaurantId, joinedAt: new Date(), lastActivityAt: new Date() }, $set: { status: "ACTIVE" } },
      { new: true, upsert: true, runValidators: true }
    );
  } catch (error) {
    if (error?.code === 11000) return LoyaltyAccount.findOne({ customer: customerId, restaurant: restaurantId });
    throw error;
  }
};

const commitLedgerChange = async ({ accountId, restaurantId, customerId, type, points, reason, eventKey = "", order = null, payment = null, reward = null, createdBy = null, metadata = {}, requireBalance = false }) => {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      if (eventKey) {
        const existing = await LoyaltyTransaction.findOne({ restaurant: restaurantId, eventKey }).session(session);
        if (existing) {
          result = { transaction: existing, account: await LoyaltyAccount.findById(existing.account).session(session), idempotent: true };
          return;
        }
      }
      const filter = { _id: accountId, restaurant: restaurantId, customer: customerId, status: "ACTIVE" };
      if (requireBalance) filter.currentPoints = { $gte: Math.abs(points) };
      const account = await LoyaltyAccount.findOne(filter).session(session);
      if (!account) throw new ApiError(requireBalance ? 409 : 404, requireBalance ? "Insufficient loyalty points" : "Active loyalty account not found");
      const previousBalance = number(account.currentPoints);
      const nextBalance = previousBalance + number(points);
      if (nextBalance < 0) throw new ApiError(409, "Insufficient loyalty points");
      account.currentPoints = nextBalance;
      if (points > 0 && type === "EARN") account.lifetimeEarnedPoints += points;
      if (points < 0 && type === "REDEEM") account.lifetimeRedeemedPoints += Math.abs(points);
      account.lastActivityAt = new Date();
      await account.save({ session });
      const transaction = await LoyaltyTransaction.create([{
        account: account._id, customer: customerId, restaurant: restaurantId, type, points, previousBalance, newBalance: nextBalance,
        order, payment, reward, reason, createdBy, eventKey, metadata,
      }], { session });
      result = { transaction: transaction[0], account, idempotent: false };
    });
  } catch (error) {
    if (error?.code === 11000 && eventKey) {
      const existing = await LoyaltyTransaction.findOne({ restaurant: restaurantId, eventKey });
      if (existing) return { transaction: existing, account: await LoyaltyAccount.findById(existing.account), idempotent: true };
    }
    if (String(error?.message || "").includes("Transaction numbers are only allowed")) throw new ApiError(503, "Loyalty changes require MongoDB replica-set transactions.");
    throw error;
  } finally { await session.endSession(); }
  return result;
};

const eligibleEarnPoints = (order, settings) => {
  if (!settings.enabled || !order?.customer || !settings.eligibleOrderTypes.includes(order.orderType)) return 0;
  const itemSpend = Math.max(0, number(order.subtotal) - number(order.discount));
  const eligibleSpend = itemSpend + (settings.includeTaxes ? number(order.tax) : 0) + (settings.includeDeliveryCharge ? number(order.deliveryCharge) : 0);
  if (eligibleSpend < number(settings.minimumOrderAmount)) return 0;
  let points = Math.floor(eligibleSpend / number(settings.spendPerPoint, 100));
  if (settings.maxPointsPerOrder) points = Math.min(points, number(settings.maxPointsPerOrder));
  return Math.max(0, points);
};

export const awardPointsForPaidOrder = async ({ order, payment }) => {
  const orderDoc = order?._id ? order : await Order.findById(order);
  if (!orderDoc?.restaurant || !orderDoc.customer || orderDoc.status !== "COMPLETED" || orderDoc.paymentStatus !== "PAID") return null;
  const settings = await getLoyaltySettings(orderDoc.restaurant);
  const points = eligibleEarnPoints(orderDoc, settings);
  if (!points) return null;
  const account = await getLoyaltyAccount(orderDoc.customer, orderDoc.restaurant);
  if (!account || account.status !== "ACTIVE") return null; // Explicit enrollment; anonymous customers are never enrolled automatically.
  return commitLedgerChange({ accountId: account._id, customerId: orderDoc.customer, restaurantId: orderDoc.restaurant, type: "EARN", points, reason: `Points earned from order #${orderDoc.orderNumber}`, eventKey: `earn:${orderDoc._id}`, order: orderDoc._id, payment: payment?._id || payment || null });
};

export const reversePointsForFullRefund = async ({ order, payment }) => {
  const orderId = order?._id || order;
  const original = await LoyaltyTransaction.findOne({ order: orderId, type: "EARN" });
  if (!original) return null;
  const account = await LoyaltyAccount.findById(original.account);
  if (!account) return null;
  // A customer may already have spent points; never create a negative balance.
  const reversal = Math.min(number(original.points), number(account.currentPoints));
  return commitLedgerChange({ accountId: account._id, customerId: original.customer, restaurantId: original.restaurant, type: "REVERSAL", points: -reversal, reason: "Points reversed after full payment refund", eventKey: `refund-reversal:${orderId}`, order: orderId, payment: payment?._id || payment || null, metadata: { earnedPoints: original.points, unappliedPoints: Math.max(number(original.points) - reversal, 0) } });
};

export const restoreRedeemedPointsForCancelledOrder = async (order, reason = "Loyalty redemption returned after order cancellation") => {
  const orderId = order?._id || order;
  const redemption = await LoyaltyTransaction.findOne({ order: orderId, type: "REDEEM" });
  if (!redemption) return null;
  return commitLedgerChange({ accountId: redemption.account, customerId: redemption.customer, restaurantId: redemption.restaurant, type: "REVERSAL", points: Math.abs(number(redemption.points)), reason, eventKey: `cancel-redemption-return:${orderId}`, order: orderId, metadata: { reversalOf: redemption._id } });
};

export const adjustLoyaltyPoints = async ({ account, points, reason, createdBy }) => {
  const delta = Math.trunc(number(points));
  if (!delta) throw new ApiError(422, "Adjustment points cannot be zero");
  return commitLedgerChange({ accountId: account._id, customerId: account.customer, restaurantId: account.restaurant, type: "ADJUSTMENT", points: delta, reason, createdBy, requireBalance: delta < 0, eventKey: `adjustment:${new mongoose.Types.ObjectId()}` });
};

export const redeemLoyaltyPoints = async ({ orderId, customerId, restaurantId, points, rewardId = null, idempotencyKey, createdBy }) => {
  const requestedPoints = Math.trunc(number(points));
  if (!idempotencyKey) throw new ApiError(422, "Idempotency-Key is required for loyalty redemption");
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const eventKey = `redeem:${orderId}:${idempotencyKey}`;
      const existing = await LoyaltyTransaction.findOne({ restaurant: restaurantId, eventKey }).session(session);
      if (existing) { result = { transaction: existing, account: await LoyaltyAccount.findById(existing.account).session(session), order: await Order.findById(orderId).session(session), idempotent: true }; return; }
      const [order, account, settings] = await Promise.all([
        Order.findOne({ _id: orderId, restaurant: restaurantId, customer: customerId, isArchived: { $ne: true } }).session(session),
        LoyaltyAccount.findOne({ customer: customerId, restaurant: restaurantId, status: "ACTIVE" }).session(session),
        LoyaltySettings.findOne({ restaurant: restaurantId }).session(session),
      ]);
      if (!order) throw new ApiError(404, "Eligible order not found");
      if (!account) throw new ApiError(409, "Customer is not enrolled in loyalty");
      if (!settings?.enabled) throw new ApiError(409, "Loyalty is not enabled for this restaurant");
      if (!settings.eligibleOrderTypes.includes(order.orderType)) throw new ApiError(422, "This order type is not eligible for loyalty redemption");
      if (["PARTIAL", "PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(order.paymentStatus) || ["COMPLETED", "CANCELLED", "REJECTED"].includes(order.status)) throw new ApiError(409, "Loyalty redemption must be applied before payment");
      let reward = null; let redemptionPoints = requestedPoints; let redemptionValue;
      if (rewardId) {
        reward = await LoyaltyReward.findOne({ _id: rewardId, restaurant: restaurantId, active: true }).session(session);
        if (!reward) throw new ApiError(404, "Active loyalty reward not found");
        if ((reward.validFrom && reward.validFrom > new Date()) || (reward.validUntil && reward.validUntil < new Date()) || (reward.eligibleOrderTypes?.length && !reward.eligibleOrderTypes.includes(order.orderType))) throw new ApiError(422, "Reward is not available for this order");
        redemptionPoints = reward.pointsRequired;
        redemptionValue = reward.type === "DISCOUNT_PERCENT" ? number(order.subtotal) * number(reward.value) / 100 : number(reward.value);
      } else redemptionValue = redemptionPoints * number(settings.pointValue);
      if (redemptionPoints < number(settings.minimumRedemptionPoints)) throw new ApiError(422, "Minimum loyalty redemption has not been met");
      if (redemptionPoints <= 0 || account.currentPoints < redemptionPoints) throw new ApiError(409, "Insufficient loyalty points");
      const maxDiscount = number(order.subtotal) * number(settings.maxRedemptionPercent) / 100;
      const loyaltyDiscount = Math.min(redemptionValue, maxDiscount, number(order.subtotal));
      if (loyaltyDiscount <= 0) throw new ApiError(422, "Loyalty redemption does not produce a valid discount");
      const manualDiscount = Math.max(0, number(order.discount) - number(order.loyaltyDiscount));
      const calculated = calculateOrderAmounts({ items: order.items, discount: manualDiscount + loyaltyDiscount, gstType: order.gstType, serviceCharge: order.serviceCharge, deliveryCharge: order.deliveryCharge, orderType: order.orderType });
      const previousBalance = number(account.currentPoints);
      account.currentPoints = previousBalance - redemptionPoints;
      account.lifetimeRedeemedPoints += redemptionPoints;
      account.lastActivityAt = new Date();
      await account.save({ session });
      Object.assign(order, calculated, { loyaltyDiscount });
      await order.save({ session });
      const [transaction] = await LoyaltyTransaction.create([{ account: account._id, customer: customerId, restaurant: restaurantId, type: "REDEEM", points: -redemptionPoints, previousBalance, newBalance: account.currentPoints, order: order._id, reward: reward?._id || null, reason: reward ? `Redeemed reward: ${reward.name}` : "Loyalty points redeemed at checkout", createdBy, eventKey, metadata: { loyaltyDiscount, manualDiscount } }], { session });
      result = { transaction, account, order, idempotent: false };
    });
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await LoyaltyTransaction.findOne({ restaurant: restaurantId, eventKey: `redeem:${orderId}:${idempotencyKey}` });
      if (existing) return { transaction: existing, account: await LoyaltyAccount.findById(existing.account), order: await Order.findById(orderId), idempotent: true };
    }
    if (String(error?.message || "").includes("Transaction numbers are only allowed")) throw new ApiError(503, "Loyalty redemption requires MongoDB replica-set transactions.");
    throw error;
  } finally { await session.endSession(); }
  return result;
};

export const loyaltySummaryForCustomer = async ({ customerId, restaurantIds }) => {
  const account = await LoyaltyAccount.findOne({ customer: customerId, restaurant: { $in: restaurantIds } }).sort({ lastActivityAt: -1 }).lean();
  if (!account) return { account: null, transactions: [] };
  const transactions = await LoyaltyTransaction.find({ account: account._id }).sort({ createdAt: -1 }).limit(20).populate("order", "orderNumber").lean();
  return { account, transactions };
};

export const listLoyaltyAccounts = async ({ restaurantIds, page = 1, limit = 20, search = "" }) => {
  const match = { restaurant: { $in: restaurantIds } };
  const pipeline = [{ $match: match }, { $lookup: { from: "users", localField: "customer", foreignField: "_id", as: "customer" } }, { $unwind: "$customer" }];
  if (search) { const regex = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); pipeline.push({ $match: { $or: [{ "customer.fullName": regex }, { "customer.phone": regex }, { "customer.email": regex }] } }); }
  pipeline.push({ $facet: { rows: [{ $sort: { lastActivityAt: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, { $project: { currentPoints: 1, lifetimeEarnedPoints: 1, lifetimeRedeemedPoints: 1, status: 1, lastActivityAt: 1, joinedAt: 1, customer: { _id: 1, fullName: 1, phone: 1, email: 1 } } }], total: [{ $count: "count" }] } });
  const [result] = await LoyaltyAccount.aggregate(pipeline);
  return { rows: result?.rows || [], total: result?.total?.[0]?.count || 0 };
};
