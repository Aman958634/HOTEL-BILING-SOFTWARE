import crypto from "crypto";
import User from "../models/User.js";
import Restaurant from "../models/Restaurant.js";
import Order from "../models/Order.js";
import Reservation from "../models/Reservation.js";
import ApiError from "../utils/ApiError.js";

export const normalizeCustomerPhone = (phone) => String(phone || "").replace(/\D/g, "");
export const normalizeCustomerEmail = (email) => String(email || "").trim().toLowerCase();

export const customerIdentityFilter = ({ phone, email }) => {
  const normalizedPhone = normalizeCustomerPhone(phone);
  const normalizedEmail = normalizeCustomerEmail(email);
  const identities = [];
  if (normalizedPhone) identities.push({ phoneNormalized: normalizedPhone });
  if (normalizedEmail) identities.push({ email: normalizedEmail });
  return identities.length ? { role: "customer", $or: identities } : null;
};

export const getAuthorizedRestaurantIds = async (user) => {
  if (user?.restaurant) return [user.restaurant];
  if (user?.hotelId) {
    const restaurants = await Restaurant.find({ $or: [{ hotelId: user.hotelId }, { hotelId: null }] }).select("_id").lean();
    return restaurants.map((restaurant) => restaurant._id);
  }
  // Maintains the application's existing super/admin-without-tenant behaviour.
  const restaurants = await Restaurant.find({}).select("_id").lean();
  return restaurants.map((restaurant) => restaurant._id);
};

export const linkCustomerToRestaurant = async (customerId, restaurantId) => {
  if (!customerId || !restaurantId) return;
  await User.updateOne(
    { _id: customerId, "customerRestaurants.restaurant": { $ne: restaurantId } },
    { $push: { customerRestaurants: { restaurant: restaurantId } } }
  );
};

/**
 * Resolves a customer only through an exact phone/email identity. Names are
 * deliberately never used for matching. A returned customer is linked to the
 * current restaurant but is never exposed by unscoped CRM queries.
 */
export const findOrCreateRestaurantCustomer = async ({ fullName, email, phone, address, restaurantId }) => {
  const identity = customerIdentityFilter({ phone, email });
  if (!identity) throw new ApiError(422, "A phone number or email is required for a customer");

  let customer = await User.findOne(identity).select("fullName email phone address role isActive isCrmArchived");
  if (customer) {
    await linkCustomerToRestaurant(customer._id, restaurantId);
    return { customer, created: false };
  }

  const normalizedEmail = normalizeCustomerEmail(email);
  const normalizedPhone = normalizeCustomerPhone(phone);
  const created = await User.create({
    fullName: String(fullName || "Guest Customer").trim(),
    ...(normalizedEmail ? { email: normalizedEmail } : {}),
    ...(phone ? { phone: String(phone).trim(), phoneNormalized: normalizedPhone } : {}),
    address: String(address || "").trim(),
    password: `Cust@${crypto.randomInt(100000, 999999)}`,
    role: "customer",
    customerRestaurants: restaurantId ? [{ restaurant: restaurantId }] : [],
  });
  customer = await User.findById(created._id).select("fullName email phone address role isActive isCrmArchived");
  return { customer, created: true };
};

export const customerScopeMatch = (restaurantIds, includeArchived = false) => ({
  role: "customer",
  ...(includeArchived ? {} : { isCrmArchived: { $ne: true } }),
  $or: [
    { restaurant: { $in: restaurantIds } },
    { "customerRestaurants.restaurant": { $in: restaurantIds } },
    // Customers connected to the restaurant through an existing order or
    // reservation are included after the $lookup relationship check.
  ],
});

export const validOrderMatch = (restaurantIds) => ({
  restaurant: { $in: restaurantIds },
  isArchived: { $ne: true },
  status: { $nin: ["CANCELLED", "REJECTED"] },
  paymentStatus: { $ne: "REFUNDED" },
});

export const getCustomerMetrics = async ({ customerId, restaurantIds }) => {
  const [orderMetrics] = await Order.aggregate([
    { $match: { customer: customerId, ...validOrderMatch(restaurantIds) } },
    { $group: { _id: null, totalOrders: { $sum: 1 }, totalSpent: { $sum: "$total" }, lastOrderAt: { $max: "$createdAt" }, firstOrderAt: { $min: "$createdAt" } } },
  ]);
  const totalOrders = orderMetrics?.totalOrders || 0;
  return {
    totalOrders,
    totalSpent: orderMetrics?.totalSpent || 0,
    averageOrderValue: totalOrders ? (orderMetrics.totalSpent || 0) / totalOrders : 0,
    lastOrderAt: orderMetrics?.lastOrderAt || null,
    firstOrderAt: orderMetrics?.firstOrderAt || null,
  };
};
