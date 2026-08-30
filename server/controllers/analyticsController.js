import Order from "../models/Order.js";
import Food from "../models/Food.js";
import Inventory from "../models/Inventory.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildOutletQuery, buildRestaurantQuery } from "../utils/tenantUtils.js";

export const dashboardStats = asyncHandler(async (req, res) => {
  // Orders and inventory are operational, outlet-owned resources. Menu items
  // are restaurant-owned in the existing schema and therefore intentionally
  // use the tenant-only helper.
  const [orderScope, inventoryScope, foodScope] = await Promise.all([
    buildOutletQuery({ isArchived: { $ne: true } }, req.user),
    buildOutletQuery({}, req.user),
    buildRestaurantQuery({}, req.user),
  ]);

  const [orders, foods, inventory] = await Promise.all([
    Order.countDocuments(orderScope),
    Food.countDocuments(foodScope),
    Inventory.countDocuments(inventoryScope),
  ]);

  const revenueAgg = await Order.aggregate([
    { $match: { ...orderScope, paymentStatus: { $in: ["PAID", "paid"] } } },
    { $group: { _id: null, revenue: { $sum: "$total" } } },
  ]);

  const dailySales = await Order.aggregate([
    { $match: orderScope },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, amount: { $sum: "$total" }, orders: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $limit: 14 },
  ]);

  res.status(200).json(
    new ApiResponse(true, "Dashboard stats", {
      cards: {
        orders,
        foods,
        inventory,
        revenue: revenueAgg[0]?.revenue || 0,
      },
      dailySales,
    })
  );
});
