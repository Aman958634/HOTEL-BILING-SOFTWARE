import Restaurant from "../models/Restaurant.js";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { createActivity } from "../services/activityService.js";
import { resolvePlan } from "../services/planService.js";
import { calculateTrialEndDate, calculateRenewalDate, toSubscriptionView } from "../utils/subscriptionUtils.js";

// GET /super-admin/restaurants
export const listRestaurants = asyncHandler(async (req, res) => {
  const { q, status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (q) {
    const pattern = new RegExp(String(q), "i");
    filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }];
  }
  if (status === "active") filter.isActive = true;
  if (status === "suspended") filter.isActive = false;

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Restaurant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    Restaurant.countDocuments(filter),
  ]);

  // enrich with admin user and subscription
  const enriched = await Promise.all(
    items.map(async (r) => {
      const admin = await User.findOne({ restaurant: r._id, role: "admin" }).select("fullName email phone role isActive lastLogin").lean();
      const subscription = await Subscription.findOne({ restaurant: r._id }).sort({ createdAt: -1 });
      return { ...r, admin, subscription: subscription ? toSubscriptionView(subscription) : null };
    })
  );

  res.status(200).json(new ApiResponse(true, "Restaurants fetched", { items: enriched, total }));
});

// POST /super-admin/restaurants
export const createRestaurant = asyncHandler(async (req, res) => {
  const {
    name,
    ownerName,
    adminFullName,
    adminEmail,
    phone,
    address,
    city,
    state,
    country,
    logoUrl,
    plan,
    status,
    password,
  } = req.body;

  if (!name) throw new Error("Restaurant name is required");
  if (!adminFullName) throw new Error("Admin name is required");
  if (!adminEmail) throw new Error("Admin email is required");

  const existingAdmin = await User.findOne({ email: adminEmail });
  if (existingAdmin) throw new ApiResponse(false, "Admin email already in use");

  // create restaurant
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now().toString().slice(-4);
  const branchCode = `B${Date.now().toString().slice(-6)}`;

  const restaurant = await Restaurant.create({
    name,
    slug,
    branchCode,
    email: adminEmail,
    phone,
    address: address || "",
    city: city || "",
    logoUrl: logoUrl || "",
    isActive: status !== "suspended",
  });

  // create admin user and bind to restaurant server-side
  const user = await User.create({ fullName: adminFullName, email: adminEmail, password: password || `Admin@${Math.floor(Math.random() * 9000) + 1000}`, role: "admin", restaurant: restaurant._id });

  // Every new restaurant gets an automatic 15-day trial unless Super Admin explicitly sets status=active.
  const planDoc = await resolvePlan(plan || "basic");
  const trialStart = restaurant.createdAt ? new Date(restaurant.createdAt) : new Date();
  const wantsPaidImmediately = status === "active";
  const isTrial = !wantsPaidImmediately;
  const trialEndDate = isTrial ? calculateTrialEndDate(trialStart) : null;

  const subscription = await Subscription.create({
    restaurant: restaurant._id,
    planId: planDoc._id,
    planName: planDoc.key,
    price: isTrial ? 0 : planDoc.price,
    billingCycle: planDoc.billingCycle || "monthly",
    status: isTrial ? "trial" : "active",
    startDate: trialStart,
    trialStartDate: isTrial ? trialStart : null,
    trialEndDate,
    subscriptionStartAt: wantsPaidImmediately ? trialStart : null,
    renewalDate: isTrial ? null : calculateRenewalDate(trialStart, planDoc.billingCycle || "monthly"),
    metadata: {
      recurringBillingEnabled: false,
      createdWithRestaurant: true,
    },
  });

  await createActivity({
    action: "Restaurant Created",
    description: `Restaurant ${name} created by super admin`,
    performedBy: req.user?.id,
    restaurantId: restaurant._id,
    targetId: user._id,
    targetType: "user",
  });

  if (isTrial) {
    await createActivity({
      action: "Trial Started",
      description: `15-day free trial started for ${name}`,
      performedBy: req.user?.id,
      restaurantId: restaurant._id,
      targetId: subscription._id,
      targetType: "subscription",
      metadata: {
        trialStartDate: trialStart.toISOString(),
        trialEndDate: trialEndDate?.toISOString(),
        plan: planDoc.key,
      },
    });
  } else {
    await createActivity({
      action: "Paid Subscription Activated",
      description: `Paid plan ${planDoc.name} activated for ${name} at restaurant creation`,
      performedBy: req.user?.id,
      restaurantId: restaurant._id,
      targetId: subscription._id,
      targetType: "subscription",
      metadata: { plan: planDoc.key, price: planDoc.price },
    });
  }

  res.status(201).json(
    new ApiResponse(true, "Restaurant created", {
      restaurant,
      admin: user,
      subscription: toSubscriptionView(subscription),
    })
  );
});

// GET /super-admin/restaurants/:id
export const getRestaurant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const restaurant = await Restaurant.findById(id).lean();
  if (!restaurant) throw new ApiResponse(false, "Restaurant not found");

  const admin = await User.findOne({ restaurant: restaurant._id, role: "admin" }).select("fullName email phone role isActive lastLogin").lean();
  const subscription = await Subscription.findOne({ restaurant: restaurant._id }).sort({ createdAt: -1 });

  // gather counts
  const [ordersCount, usersCount] = await Promise.all([
    // Order model may not always exist; guard
    (async () => {
      try {
        const Order = (await import("../models/Order.js")).default;
        return await Order.countDocuments({ restaurant: restaurant._id });
      } catch (_e) {
        return 0;
      }
    })(),
    User.countDocuments({ restaurant: restaurant._id }),
  ]);

  res.status(200).json(
    new ApiResponse(true, "Restaurant fetched", {
      restaurant,
      admin,
      subscription: subscription ? toSubscriptionView(subscription) : null,
      ordersCount,
      usersCount,
    })
  );
});

// PUT /super-admin/restaurants/:id
export const updateRestaurant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const update = { ...req.body };
  delete update.restaurant; // prevent changing tenant association from client
  const restaurant = await Restaurant.findByIdAndUpdate(id, update, { new: true }).lean();
  if (!restaurant) throw new ApiResponse(false, "Restaurant not found");

  await createActivity({ action: "Restaurant Updated", description: `Restaurant ${restaurant.name} updated`, performedBy: req.user?.id, restaurantId: restaurant._id });

  res.status(200).json(new ApiResponse(true, "Restaurant updated", { restaurant }));
});

// PATCH /super-admin/restaurants/:id/status
export const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const restaurant = await Restaurant.findById(id);
  if (!restaurant) throw new ApiResponse(false, "Restaurant not found");

  const prev = restaurant.isActive;
  restaurant.isActive = status === "active";
  await restaurant.save();

  await createActivity({ action: `Restaurant ${status === "active" ? "Activated" : "Suspended"}`, description: `Restaurant ${restaurant.name} ${status}`, performedBy: req.user?.id, restaurantId: restaurant._id });

  res.status(200).json(new ApiResponse(true, "Status updated", { restaurant }));
});

export default {
  listRestaurants,
  createRestaurant,
  getRestaurant,
  updateRestaurant,
  updateStatus,
};
