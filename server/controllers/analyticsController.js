import Order from "../models/Order.js";
import Food from "../models/Food.js";
import Inventory from "../models/Inventory.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

export const dashboardStats = asyncHandler(async (_req, res) => {
  const [orders, foods, inventory] = await Promise.all([
    Order.countDocuments(),
    Food.countDocuments(),
    Inventory.countDocuments(),
  ]);

  const revenueAgg = await Order.aggregate([
    { $match: { paymentStatus: { $in: ["PAID", "paid"] }, isArchived: { $ne: true } } },
    { $group: { _id: null, revenue: { $sum: "$total" } } },
  ]);

  const dailySales = await Order.aggregate([
    { $match: { isArchived: { $ne: true } } },
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
